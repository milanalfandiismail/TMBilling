using System;
using System.IO;
using System.Linq;
using System.Management;
using System.Net.NetworkInformation;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Collections.Generic;
using LibreHardwareMonitor.Hardware;

namespace MonitoringAgent
{
    public class PcMetricPayload
    {
        public string MachineName { get; set; } = string.Empty;
        public float CpuUsage { get; set; }
        public float CpuTemp { get; set; }
        public float GpuTemp { get; set; }
        public string NicSpeed { get; set; } = "Disconnected";
        public string TotalRam { get; set; } = "0 GB";
        public DateTime Timestamp { get; set; }
        public string Motherboard { get; set; } = "Unknown";
        public string CpuName { get; set; } = "Unknown";
        public string GpuName { get; set; } = "Unknown";
        
        // --- NEW MONITORING FIELDS ---
        public string ActiveWindow { get; set; } = "Unknown";
        public List<ProcessInfo> ProcessList { get; set; } = new List<ProcessInfo>();
    }

    public class ProcessInfo
    {
        public string Name { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
    }

    class Program
    {
        private static readonly HttpClient client = new HttpClient();
        private static string SERVER_ENDPOINT = "http://127.0.0.1:5000/api/monitor";
        private static int UPDATE_INTERVAL_SECONDS = 60;
        private const string CONFIG_FILE = "config.ini";
        private const string LOG_FILE = "monitor.log";
        private static int iteration = 0;

        // --- WIN32 API FOR ACTIVE WINDOW ---
        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

        static async Task Main(string[] args)
        {
            // LOG STARTUP SAJA
            WriteLog("========================================");
            WriteLog($"HARDWARE MONITOR STARTED");
            WriteLog($"Machine: {Environment.MachineName}");
            WriteLog($"Time: {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
            WriteLog("========================================");

            LoadConfiguration();

            Computer computer = new Computer
            {
                IsCpuEnabled = true,
                IsGpuEnabled = true,
                IsMemoryEnabled = true,
                IsMotherboardEnabled = true,
                IsNetworkEnabled = false
            };

            try
            {
                computer.Open();
                WriteLog("✅ Hardware monitor initialized");
            }
            catch (Exception ex)
            {
                WriteLog($"❌ FATAL ERROR: {ex.Message}");
                WriteLog("❌ WAJIB RUN AS ADMINISTRATOR!");
                return;
            }

            string motherboardInfo = GetMotherboardInfo();
            string cpuName = GetCpuInfo();
            string gpuName = "Unknown";

            WriteLog($"🖥️  Motherboard: {motherboardInfo}");
            WriteLog($"💻 CPU: {cpuName}");
            WriteLog($"🔗 Server: {SERVER_ENDPOINT}");
            WriteLog($"⏱️  Interval: {UPDATE_INTERVAL_SECONDS} seconds");
            WriteLog("========================================");

            // Deteksi GPU
            foreach (IHardware hardware in computer.Hardware)
            {
                hardware.Update();
                
                if (hardware.HardwareType.ToString().Contains("Gpu"))
                {
                    gpuName = hardware.Name;
                    WriteLog($"🎮 GPU Detected: {gpuName}");
                    break;
                }
            }

            WriteLog("\n🔄 Starting monitoring loop...");
            WriteLog($"(Data sent every {UPDATE_INTERVAL_SECONDS} seconds)");
            WriteLog("========================================\n");

            // MAIN LOOP - TIDAK LOG SETIAP ITERATION
            while (true)
            {
                iteration++;
                try
                {
                    // TIDAK LOG ITERATION DI SINI
                    await CollectAndSendData(computer, motherboardInfo, cpuName, gpuName);
                }
                catch (Exception ex)
                {
                    // HANYA LOG ERROR
                    WriteLog($"[ERROR Iteration {iteration}] {ex.Message}");
                }

                await Task.Delay(UPDATE_INTERVAL_SECONDS * 1000);
            }
        }

        static async Task CollectAndSendData(Computer computer, string motherboardInfo, string cpuName, string gpuName)
        {
            float cpuLoad = 0;
            float cpuTemp = 0;
            float gpuTemp = 0;
            string ramTotalInfo = "0 GB";

            // Baca semua sensor
            foreach (IHardware hardware in computer.Hardware)
            {
                hardware.Update();

                if (hardware.HardwareType == HardwareType.Cpu)
                {
                    var loadSensor = hardware.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Load && s.Name.Contains("Total"));
                    if (loadSensor != null) cpuLoad = loadSensor.Value.GetValueOrDefault();
                    
                    var tempSensor = hardware.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Temperature && (s.Name.Contains("Package") || s.Name.Contains("Tdie"))) 
                                  ?? hardware.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Temperature && s.Name.Contains("Core"));
                    
                    if (tempSensor != null) cpuTemp = tempSensor.Value.GetValueOrDefault();
                }

                if (hardware.HardwareType.ToString().Contains("Gpu"))
                {
                    var gpuSensor = hardware.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Temperature && s.Name.Contains("Core"));
                    if (gpuSensor != null) gpuTemp = gpuSensor.Value.GetValueOrDefault();
                }

                if (hardware.HardwareType == HardwareType.Memory)
                {
                    var usedSensor = hardware.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Data && s.Name.Contains("Used"));
                    var availSensor = hardware.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Data && s.Name.Contains("Available"));

                    if (usedSensor != null && availSensor != null)
                    {
                        float totalRamGb = usedSensor.Value.GetValueOrDefault() + availSensor.Value.GetValueOrDefault();
                        ramTotalInfo = $"{Math.Round(totalRamGb, 1)} GB";
                    }
                }
            }

            // Network Speed
            string linkSpeed = "Disconnected";
            foreach (NetworkInterface nic in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (nic.OperationalStatus == OperationalStatus.Up &&
                    nic.NetworkInterfaceType != NetworkInterfaceType.Loopback &&
                    nic.Speed > 0)
                {
                    double speedM = nic.Speed / 1000000.0;
                    linkSpeed = speedM >= 1000 ? $"{(speedM/1000):0.#} Gbps" : $"{speedM:0} Mbps";
                    break;
                }
            }

            // BULATKAN TEMPERATUR
            int cpuTempRounded = (int)Math.Round(cpuTemp);
            int gpuTempRounded = (int)Math.Round(gpuTemp);

            // TIDAK LOG DATA SENSOR DI SINI (HANYA KIRIM KE SERVER)

            // --- NEW: PROCESS MONITORING ---
            string activeWin = GetActiveWindowTitle();
            List<ProcessInfo> pList = GetRunningProcesses();

            // Buat payload
            var payload = new PcMetricPayload
            {
                MachineName = Environment.MachineName,
                CpuUsage = (float)Math.Round(cpuLoad, 1),
                CpuTemp = cpuTempRounded,
                GpuTemp = gpuTempRounded,
                NicSpeed = linkSpeed,
                TotalRam = ramTotalInfo,
                Timestamp = DateTime.Now,
                Motherboard = motherboardInfo,
                CpuName = cpuName,
                GpuName = gpuName,
                ActiveWindow = activeWin,
                ProcessList = pList
            };

            // Kirim ke server
            try
            {
                string jsonString = JsonSerializer.Serialize(payload);
                var content = new StringContent(jsonString, Encoding.UTF8, "application/json");
                
                var response = await client.PostAsync(SERVER_ENDPOINT, content);
                
                if (!response.IsSuccessStatusCode)
                {
                    // HANYA LOG JIKA GAGAL
                    WriteLog($"[FAIL Iteration {iteration}] Server response: {response.StatusCode}");
                }
            }
            catch (Exception ex)
            {
                // LOG JIKA ERROR KONEKSI
                WriteLog($"[ERROR Iteration {iteration}] Connection failed: {ex.Message}");
            }
        }

        static string GetMotherboardInfo()
        {
            try
            {
                using (var searcher = new ManagementObjectSearcher("SELECT * FROM Win32_BaseBoard"))
                {
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        string manufacturer = obj["Manufacturer"]?.ToString() ?? "Unknown";
                        string product = obj["Product"]?.ToString() ?? "Unknown";
                        return $"{manufacturer} {product}";
                    }
                }
            }
            catch { }
            return "Unknown";
        }

        static string GetCpuInfo()
        {
            try
            {
                using (var searcher = new ManagementObjectSearcher("SELECT * FROM Win32_Processor"))
                {
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        return obj["Name"]?.ToString() ?? "Unknown CPU";
                    }
                }
            }
            catch { }
            return "Unknown CPU";
        }

        static void LoadConfiguration()
        {
            try
            {
                if (!File.Exists(CONFIG_FILE))
                {
                    WriteLog("📄 Creating default config file...");
                    string defaultConfig = 
                        "ServerUrl=http://127.0.0.1:5000/api/monitor\n" +
                        "UpdateInterval=60";
                    File.WriteAllText(CONFIG_FILE, defaultConfig);
                    
                    SERVER_ENDPOINT = "http://127.0.0.1:5000/api/monitor";
                    UPDATE_INTERVAL_SECONDS = 60;
                }
                else
                {
                    string[] lines = File.ReadAllLines(CONFIG_FILE);
                    foreach (string line in lines)
                    {
                        string trimmedLine = line.Trim();
                        
                        if (string.IsNullOrEmpty(trimmedLine) || trimmedLine.StartsWith("#"))
                            continue;
                        
                        if (trimmedLine.StartsWith("ServerUrl=", StringComparison.OrdinalIgnoreCase))
                        {
                            string url = trimmedLine.Split('=')[1].Trim();
                            if (!string.IsNullOrEmpty(url)) 
                                SERVER_ENDPOINT = url;
                        }
                        else if (trimmedLine.StartsWith("UpdateInterval=", StringComparison.OrdinalIgnoreCase))
                        {
                            string intervalStr = trimmedLine.Split('=')[1].Trim();
                            if (int.TryParse(intervalStr, out int interval))
                            {
                                if (interval < 10) UPDATE_INTERVAL_SECONDS = 10;
                                else if (interval > 3600) UPDATE_INTERVAL_SECONDS = 3600;
                                else UPDATE_INTERVAL_SECONDS = interval;
                            }
                        }
                    }
                }
                WriteLog($"📄 Config loaded: Server={SERVER_ENDPOINT}, Interval={UPDATE_INTERVAL_SECONDS}s");
            }
            catch (Exception ex)
            {
                WriteLog($"⚠️ Config error: {ex.Message}");
            }
        }

        static void WriteLog(string message)
        {
            try
            {
                string logMessage = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}";
                File.AppendAllText(LOG_FILE, logMessage + Environment.NewLine);
            }
            catch { }
        }

        // --- HELPER METHODS FOR MONITORING ---

        private static string GetActiveWindowTitle()
        {
            const int nChars = 256;
            StringBuilder Buff = new StringBuilder(nChars);
            IntPtr handle = GetForegroundWindow();

            if (GetWindowText(handle, Buff, nChars) > 0)
            {
                return Buff.ToString();
            }
            return "Desktop / Idle";
        }

        private static List<ProcessInfo> GetRunningProcesses()
        {
            List<ProcessInfo> list = new List<ProcessInfo>();
            const long MEM_THRESHOLD = 100 * 1024 * 1024; // 100MB dalam bytes
            try
            {
                Process[] processes = Process.GetProcesses();
                foreach (Process p in processes)
                {
                    try
                    {
                        // Filter: Hanya ambil yang pakai RAM > 100MB
                        long memUsage = p.WorkingSet64;
                        if (memUsage > MEM_THRESHOLD)
                        {
                            string ramInfo = $"[{(memUsage / 1024 / 1024)} MB]";
                            string title = string.IsNullOrEmpty(p.MainWindowTitle) ? "Background Process" : p.MainWindowTitle;
                            
                            list.Add(new ProcessInfo 
                            { 
                                Name = p.ProcessName + ".exe", 
                                Title = $"{ramInfo} {title}" 
                            });
                        }
                    }
                    catch { /* Skip protected processes */ }
                }
            }
            catch (Exception ex) { WriteLog($"?? Error listing processes: {ex.Message}"); }
            return list;
        }
    }
}