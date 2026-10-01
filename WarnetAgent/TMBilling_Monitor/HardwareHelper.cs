using System;
using System.IO;
using System.Linq;
using System.Globalization;
using System.Threading;
using LibreHardwareMonitor.Hardware;

class Program
{
    static void ResolveSpecs(Computer computer, ref string staticMotherboard, ref string staticCpuName, ref string staticGpuName)
    {
        foreach (IHardware hardware in computer.Hardware)
        {
            try
            {
                hardware.Update();
                if (hardware.HardwareType == HardwareType.Motherboard && !string.IsNullOrWhiteSpace(hardware.Name))
                {
                    string moboName = hardware.Name.Trim();
                    if (staticMotherboard == "Unknown" || !moboName.Equals("Motherboard", StringComparison.OrdinalIgnoreCase))
                    {
                        staticMotherboard = moboName;
                    }
                }
                else if (hardware.HardwareType == HardwareType.Cpu && !string.IsNullOrWhiteSpace(hardware.Name))
                {
                    staticCpuName = hardware.Name.Trim();
                }
                else if (hardware.HardwareType.ToString().Contains("Gpu") && !string.IsNullOrWhiteSpace(hardware.Name))
                {
                    string gName = hardware.Name.Trim();
                    bool isDedicated = hardware.HardwareType == HardwareType.GpuNvidia 
                                    || hardware.HardwareType == HardwareType.GpuAmd 
                                    || gName.IndexOf("GeForce", StringComparison.OrdinalIgnoreCase) >= 0 
                                    || gName.IndexOf("Radeon", StringComparison.OrdinalIgnoreCase) >= 0 
                                    || gName.IndexOf("NVIDIA", StringComparison.OrdinalIgnoreCase) >= 0 
                                    || gName.IndexOf("RTX", StringComparison.OrdinalIgnoreCase) >= 0 
                                    || gName.IndexOf("GTX", StringComparison.OrdinalIgnoreCase) >= 0 
                                    || gName.IndexOf("Arc", StringComparison.OrdinalIgnoreCase) >= 0;

                    if (isDedicated || staticGpuName == "Unknown" || string.IsNullOrWhiteSpace(staticGpuName))
                    {
                        staticGpuName = gName;
                    }
                }
            }
            catch { }
        }
    }

    static void Main(string[] args)
    {
        // Paksa format bahasa Inggris untuk angka desimal (.) agar parsing Rust tidak pecah
        System.Threading.Thread.CurrentThread.CurrentCulture = CultureInfo.InvariantCulture;
        
        bool daemonMode = args != null && args.Any(a => a.Equals("--daemon", StringComparison.OrdinalIgnoreCase) || a.Equals("--loop", StringComparison.OrdinalIgnoreCase));

        Computer computer = new Computer
        {
            IsCpuEnabled = true,
            IsGpuEnabled = true,
            IsMemoryEnabled = true,
            IsMotherboardEnabled = true
        };

        try
        {
            // Reset atribut .sys ke Normal sebelum open agar LibreHardwareMonitor tidak error jika sebelumnya terkunci
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                foreach (string sysFile in Directory.GetFiles(baseDir, "*.sys"))
                {
                    File.SetAttributes(sysFile, FileAttributes.Normal);
                }
            }
            catch { }

            computer.Open();

            // Sembari terbuka, set kembali ke ReadOnly agar file driver tidak dihapus saat computer.Close() / exit
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                foreach (string sysFile in Directory.GetFiles(baseDir, "*.sys"))
                {
                    File.SetAttributes(sysFile, File.GetAttributes(sysFile) | FileAttributes.ReadOnly);
                }
            }
            catch { }

            // 1. Resolve Static Hardware Specs (Motherboard, CPU Name, GPU Name) 1x di awal
            string staticMotherboard = "Unknown";
            string staticCpuName = "Unknown";
            string staticGpuName = "Unknown";

            ResolveSpecs(computer, ref staticMotherboard, ref staticCpuName, ref staticGpuName);

            int cachedIntervalMs = 1000;
            DateTime lastIntervalFileTime = DateTime.MinValue;

            do
            {
                if (daemonMode && (staticMotherboard == "Unknown" || staticCpuName == "Unknown" || staticGpuName == "Unknown"))
                {
                    ResolveSpecs(computer, ref staticMotherboard, ref staticCpuName, ref staticGpuName);
                }

                float cpuLoad = 0;
                float cpuTemp = 0;
                float gpuTemp = 0;
                string ramInfo = "0 GB";

                foreach (IHardware hardware in computer.Hardware)
                {
                    try
                    {
                        hardware.Update();

                        // 1. Baca CPU Load & Temp
                        if (hardware.HardwareType == HardwareType.Cpu)
                        {
                            var loadSensor = hardware.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Load && s.Name.Contains("Total"));
                            if (loadSensor != null) cpuLoad = loadSensor.Value.GetValueOrDefault();
                            
                            var tempSensor = hardware.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Temperature && (s.Name.Contains("Package") || s.Name.Contains("Tdie"))) 
                                          ?? hardware.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Temperature && s.Name.Contains("Core"));
                            
                            if (tempSensor != null) cpuTemp = tempSensor.Value.GetValueOrDefault();
                        }

                        // 2. Baca GPU Temp
                        if (hardware.HardwareType.ToString().Contains("Gpu"))
                        {
                            var gpuSensor = hardware.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Temperature && s.Name.Contains("Core"));
                            if (gpuSensor != null) gpuTemp = gpuSensor.Value.GetValueOrDefault();
                        }

                        // 3. Baca Memory (RAM)
                        if (hardware.HardwareType == HardwareType.Memory)
                        {
                            var usedSensor = hardware.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Data && s.Name.Contains("Used"));
                            var availSensor = hardware.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Data && s.Name.Contains("Available"));

                            if (usedSensor != null && availSensor != null)
                            {
                                float totalRamGb = usedSensor.Value.GetValueOrDefault() + availSensor.Value.GetValueOrDefault();
                                ramInfo = Math.Round(totalRamGb, 1) + " GB";
                            }
                        }
                    }
                    catch { }
                }

                string json = "{\"CpuUsage\":" + cpuLoad.ToString(CultureInfo.InvariantCulture) + 
                    ",\"CpuTemp\":" + cpuTemp.ToString(CultureInfo.InvariantCulture) + 
                    ",\"GpuTemp\":" + gpuTemp.ToString(CultureInfo.InvariantCulture) + 
                    ",\"TotalRam\":\"" + ramInfo + 
                    "\",\"Motherboard\":\"" + staticMotherboard.Replace("\"", "\\\"") + 
                    "\",\"CpuName\":\"" + staticCpuName.Replace("\"", "\\\"") + 
                    "\",\"GpuName\":\"" + staticGpuName.Replace("\"", "\\\"") + "\"" +
                    "}";

                if (daemonMode)
                {
                    try
                    {
                        string tempFile = "hardware_temp.json.tmp";
                        string targetFile = "hardware_temp.json";
                        File.WriteAllText(tempFile, json);
                        if (File.Exists(targetFile)) File.Delete(targetFile);
                        File.Move(tempFile, targetFile);
                    }
                    catch { }

                    // Baca interval dinamis HANYA jika file hardware_interval.txt berubah timestamp-nya!
                    try
                    {
                        if (File.Exists("hardware_interval.txt"))
                        {
                            DateTime writeTime = File.GetLastWriteTimeUtc("hardware_interval.txt");
                            if (writeTime != lastIntervalFileTime)
                            {
                                lastIntervalFileTime = writeTime;
                                string raw = File.ReadAllText("hardware_interval.txt").Trim();
                                int parsedSec;
                                if (int.TryParse(raw, out parsedSec) && parsedSec >= 1 && parsedSec <= 60)
                                {
                                    cachedIntervalMs = parsedSec * 1000;
                                }
                            }
                        }
                    }
                    catch { }

                    // Sleep langsung dari cache RAM in-memory (0 disk I/O)
                    Thread.Sleep(cachedIntervalMs);
                }
                else
                {
                    Console.WriteLine(json);
                    break;
                }
            } while (daemonMode);

            computer.Close();
        }
        catch (Exception)
        {
            // Abaikan error secara aman
        }
    }
}
