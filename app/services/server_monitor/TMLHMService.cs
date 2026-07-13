using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Collections.Generic;
using LibreHardwareMonitor.Hardware;
using System.Net.NetworkInformation;
using System.Globalization;
using System.Management;

class Program
{
    static Dictionary<string, long> lastRx = new Dictionary<string, long>();
    static Dictionary<string, long> lastTx = new Dictionary<string, long>();
    static DateTime lastTime = DateTime.UtcNow;
    static int physicalCores = 0;
    static int logicalThreads = Environment.ProcessorCount;

    static void Main(string[] args)
    {
        try {
            foreach (var item in new ManagementObjectSearcher("Select NumberOfCores from Win32_Processor").Get()) {
                physicalCores += int.Parse(item["NumberOfCores"].ToString());
            }
        } catch {
            physicalCores = Environment.ProcessorCount;
        }
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        string tmpDir = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "tmp"));
        if (!Directory.Exists(tmpDir)) Directory.CreateDirectory(tmpDir);
        string jsonPath = Path.Combine(tmpDir, "lhm_metrics.json");

        Console.WriteLine("TMLHMService starting...");
        
        Computer computer = new Computer
        {
            IsCpuEnabled = true,
            IsGpuEnabled = true,
            IsMotherboardEnabled = false,
            IsMemoryEnabled = true,
            IsNetworkEnabled = false,
            IsStorageEnabled = false
        };
        computer.Open();

        while (true)
        {
            try
            {
                string cpuName = "Unknown";
                float cpuPercent = 0;
                float cpuTemp = 0;
                float cpuFreq = 0;

                var gpuList = new List<string>();

                float ramTotalGb = 0;
                float ramUsedGb = 0;

                foreach (IHardware hw in computer.Hardware)
                {
                    hw.Update();
                    if (hw.HardwareType == HardwareType.Cpu)
                    {
                        cpuName = hw.Name;
                        var load = hw.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Load && s.Name.Contains("Total"));
                        if (load != null && load.Value.HasValue) cpuPercent = load.Value.Value;

                        var temp = hw.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Temperature && s.Name.Contains("Package"));
                        if (temp == null) temp = hw.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Temperature);
                        if (temp != null && temp.Value.HasValue) cpuTemp = temp.Value.Value;

                        var clock = hw.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Clock);
                        if (clock != null && clock.Value.HasValue) cpuFreq = clock.Value.Value;
                    }

                    if (hw.HardwareType == HardwareType.GpuNvidia || hw.HardwareType == HardwareType.GpuAmd)
                    {
                        float gLoad = 0, gTemp = 0, gMemTot = 0, gMemUse = 0;
                        var gloadS = hw.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Load && s.Name.Contains("Core"));
                        if (gloadS != null && gloadS.Value.HasValue) gLoad = gloadS.Value.Value;

                        var gtempS = hw.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Temperature && s.Name.Contains("Core"));
                        if (gtempS != null && gtempS.Value.HasValue) gTemp = gtempS.Value.Value;

                        var gmTot = hw.Sensors.FirstOrDefault(s => s.SensorType == SensorType.SmallData && (s.Name.Contains("Memory Total") || s.Name.Contains("Memory Dedicated")));
                        if (gmTot != null && gmTot.Value.HasValue) gMemTot = gmTot.Value.Value;

                        var gmUse = hw.Sensors.FirstOrDefault(s => s.SensorType == SensorType.SmallData && s.Name.Contains("Memory Used"));
                        if (gmUse != null && gmUse.Value.HasValue) gMemUse = gmUse.Value.Value;

                        string gJson = string.Format("{{\"name\": \"{0}\", \"load\": {1}, \"mem_used_mb\": {2}, \"mem_total_mb\": {3}, \"temp_c\": {4}}}",
                            hw.Name.Replace("\"", "\\\""),
                            gLoad.ToString(CultureInfo.InvariantCulture),
                            gMemUse.ToString(CultureInfo.InvariantCulture),
                            gMemTot.ToString(CultureInfo.InvariantCulture),
                            gTemp.ToString(CultureInfo.InvariantCulture));
                        gpuList.Add(gJson);
                    }

                    if (hw.HardwareType == HardwareType.Memory)
                    {
                        var mTot = hw.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Data && s.Name == "Memory Used");
                        var mFree = hw.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Data && s.Name == "Memory Available");
                        if (mTot != null && mTot.Value.HasValue) ramUsedGb = mTot.Value.Value;
                        if (mFree != null && mFree.Value.HasValue) ramTotalGb = ramUsedGb + mFree.Value.Value;
                    }
                }

                var diskList = new List<string>();
                foreach (var drive in DriveInfo.GetDrives())
                {
                    if (drive.IsReady && drive.DriveType != DriveType.CDRom)
                    {
                        long total = drive.TotalSize;
                        long free = drive.TotalFreeSpace;
                        long used = total - free;
                        float pct = total > 0 ? (used * 100f / total) : 0;
                        string dJson = string.Format("{{\"device\": \"{0}\", \"mountpoint\": \"{1}\", \"fstype\": \"{2}\", \"total\": {3}, \"used\": {4}, \"free\": {5}, \"percent\": {6}}}",
                            drive.Name.Replace("\\", "\\\\"),
                            drive.Name.Replace("\\", "\\\\"),
                            drive.DriveFormat,
                            total,
                            used,
                            free,
                            pct.ToString(CultureInfo.InvariantCulture));
                        diskList.Add(dJson);
                    }
                }

                DateTime now = DateTime.UtcNow;
                double seconds = (now - lastTime).TotalSeconds;
                lastTime = now;
                var nicList = new List<string>();

                foreach (NetworkInterface nic in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (nic.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
                    
                    var ipProps = nic.GetIPProperties();
                    string ipAddr = "No IP";
                    foreach (var ip in ipProps.UnicastAddresses) {
                        if (ip.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork) {
                            ipAddr = ip.Address.ToString();
                            break;
                        }
                    }

                    var stats = nic.GetIPv4Statistics();
                    long rx = stats.BytesReceived;
                    long tx = stats.BytesSent;

                    long lastR = lastRx.ContainsKey(nic.Id) ? lastRx[nic.Id] : rx;
                    long lastT = lastTx.ContainsKey(nic.Id) ? lastTx[nic.Id] : tx;

                    double rxSpeed = seconds > 0 ? (rx - lastR) / seconds : 0;
                    double txSpeed = seconds > 0 ? (tx - lastT) / seconds : 0;

                    lastRx[nic.Id] = rx;
                    lastTx[nic.Id] = tx;

                    double speedMbps = nic.Speed > 0 ? nic.Speed / 1000000.0 : 0;
                    double totalRxMb = rx / (1024.0 * 1024.0);
                    double totalTxMb = tx / (1024.0 * 1024.0);
                    
                    bool isUp = nic.OperationalStatus == OperationalStatus.Up;

                    string nJson = string.Format("{{\"name\": \"{0}\", \"ip_address\": \"{1}\", \"is_up\": {2}, \"speed_mbps\": {3}, \"rx_bytes_sec\": {4}, \"tx_bytes_sec\": {5}, \"total_rx_mb\": {6}, \"total_tx_mb\": {7}}}",
                        nic.Name,
                        ipAddr,
                        isUp ? "true" : "false",
                        speedMbps.ToString(CultureInfo.InvariantCulture),
                        rxSpeed.ToString(CultureInfo.InvariantCulture),
                        txSpeed.ToString(CultureInfo.InvariantCulture),
                        totalRxMb.ToString(CultureInfo.InvariantCulture),
                        totalTxMb.ToString(CultureInfo.InvariantCulture));
                    nicList.Add(nJson);
                }

                long ramTotalBytes = (long)(ramTotalGb * 1024 * 1024 * 1024);
                long ramUsedBytes = (long)(ramUsedGb * 1024 * 1024 * 1024);
                long ramFreeBytes = ramTotalBytes - ramUsedBytes;
                float ramPct = ramTotalBytes > 0 ? (ramUsedBytes * 100f / ramTotalBytes) : 0;

                string finalJson = "{" +
                    "\"timestamp\": " + DateTimeOffset.UtcNow.ToUnixTimeSeconds() + "," +
                    "\"cpu\": {" +
                        "\"name\": \"" + cpuName + "\"," +
                        "\"percent\": " + cpuPercent.ToString(CultureInfo.InvariantCulture) + "," +
                        "\"cores\": " + physicalCores + "," +
                        "\"threads\": " + logicalThreads + "," +
                        "\"freq_mhz\": " + cpuFreq.ToString(CultureInfo.InvariantCulture) + "," +
                        "\"temp\": " + cpuTemp.ToString(CultureInfo.InvariantCulture) + 
                    "}," +
                    "\"ram\": {" +
                        "\"total\": " + ramTotalBytes + "," +
                        "\"used\": " + ramUsedBytes + "," +
                        "\"free\": " + ramFreeBytes + "," +
                        "\"percent\": " + ramPct.ToString(CultureInfo.InvariantCulture) +
                    "}," +
                    "\"disk\": [" + string.Join(",", diskList) + "]," +
                    "\"nic\": [" + string.Join(",", nicList) + "]," +
                    "\"gpu\": [" + string.Join(",", gpuList) + "]" +
                "}";

                File.WriteAllText(jsonPath, finalJson);
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error: " + ex.Message);
            }

            Thread.Sleep(2000);
        }
    }
}
