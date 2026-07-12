using System;
using System.IO;
using System.Linq;
using System.Globalization;
using System.Management;
using LibreHardwareMonitor.Hardware;

class Program
{
    static string GetWmiProperty(string query, string property)
    {
        try
        {
            using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(query))
            {
                foreach (ManagementObject obj in searcher.Get())
                {
                    object val = obj[property];
                    if (val != null) return val.ToString().Trim().Replace("\"", "\\\"");
                }
            }
        }
        catch { }
        return "Unknown";
    }

    static string[] GetWmiProperties(string query, string property)
    {
        var list = new System.Collections.Generic.List<string>();
        try
        {
            using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(query))
            {
                foreach (ManagementObject obj in searcher.Get())
                {
                    object val = obj[property];
                    if (val != null)
                    {
                        string str = val.ToString().Trim().Replace("\"", "\\\"");
                        if (!string.IsNullOrEmpty(str)) list.Add(str);
                    }
                }
            }
        }
        catch { }
        return list.ToArray();
    }

    static string[] GetRamSerials()
    {
        var list = new System.Collections.Generic.List<string>();
        try
        {
            using (ManagementObjectSearcher searcher = new ManagementObjectSearcher("SELECT SerialNumber, Capacity FROM Win32_PhysicalMemory"))
            {
                foreach (ManagementObject obj in searcher.Get())
                {
                    object snObj = obj["SerialNumber"];
                    string sn = snObj != null ? snObj.ToString().Trim() : "Unknown";
                    object capObj = obj["Capacity"];
                    string cap = capObj != null ? capObj.ToString().Trim() : "0";
                    // Bersihkan karakter petik dua
                    sn = sn.Replace("\"", "\\\"");
                    list.Add(sn + "_" + cap);
                }
            }
        }
        catch { }
        return list.ToArray();
    }

    static string[] GetDiskSerials()
    {
        var list = new System.Collections.Generic.List<string>();
        try
        {
            using (ManagementObjectSearcher searcher = new ManagementObjectSearcher("SELECT SerialNumber, Model FROM Win32_DiskDrive"))
            {
                foreach (ManagementObject obj in searcher.Get())
                {
                    object snObj = obj["SerialNumber"];
                    string sn = snObj != null ? snObj.ToString().Trim() : "";
                    object modelObj = obj["Model"];
                    string model = modelObj != null ? modelObj.ToString().Trim() : "";
                    
                    // Lewati disk jika serial kosong atau bertuliskan "Unknown"
                    if (string.IsNullOrEmpty(sn) || sn.ToLower().Contains("unknown"))
                        continue;
                        
                    // Lewati jika terdeteksi drive virtual sistem diskless (CCBoot, iSCSI, dll.)
                    string modelLower = model.ToLower();
                    if (modelLower.Contains("ccboot") || 
                        modelLower.Contains("iscsi") || 
                        modelLower.Contains("scsi") || 
                        modelLower.Contains("virtual") || 
                        modelLower.Contains("sanboot") || 
                        modelLower.Contains("superspeed"))
                    {
                        continue;
                    }
                    
                    // Bersihkan karakter petik dua
                    sn = sn.Replace("\"", "\\\"");
                    model = model.Replace("\"", "\\\"");
                    list.Add(model + "_" + sn);
                }
            }
        }
        catch { }
        return list.ToArray();
    }

    static void Main()
    {
        // Paksa format bahasa Inggris untuk angka desimal (.) agar parsing Rust tidak pecah
        System.Threading.Thread.CurrentThread.CurrentCulture = CultureInfo.InvariantCulture;
        
        float cpuLoad = 0;
        float cpuTemp = 0;
        float gpuTemp = 0;
        string motherboard = "Unknown";
        string cpuName = "Unknown";
        string gpuName = "Unknown";
        string ramInfo = "0 GB";

        Computer computer = new Computer
        {
            IsCpuEnabled = true,
            IsGpuEnabled = true,
            IsMemoryEnabled = true,
            IsMotherboardEnabled = true
        };

        try
        {
            computer.Open();

            // 🛠 Hack Elegan: Cegah penghapusan otomatis driver (.sys) saat close/exit
            // dengan menandai file .sys sebagai Read-Only.
            // Dengan cara ini, file driver akan tetap ada di disk secara permanen, sehingga pada
            // pemanggilan berikutnya LibreHardwareMonitor tidak perlu melakukan disk write ulang untuk ekstraksi.
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                foreach (string sysFile in Directory.GetFiles(baseDir, "*.sys"))
                {
                    File.SetAttributes(sysFile, File.GetAttributes(sysFile) | FileAttributes.ReadOnly);
                }
            }
            catch { }

            foreach (IHardware hardware in computer.Hardware)
            {
                hardware.Update();

                // 1. Baca Motherboard
                if (hardware.HardwareType == HardwareType.Motherboard)
                {
                    motherboard = hardware.Name;
                }

                // 2. Baca CPU
                if (hardware.HardwareType == HardwareType.Cpu)
                {
                    cpuName = hardware.Name;
                    var loadSensor = hardware.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Load && s.Name.Contains("Total"));
                    if (loadSensor != null) cpuLoad = loadSensor.Value.GetValueOrDefault();
                    
                    var tempSensor = hardware.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Temperature && (s.Name.Contains("Package") || s.Name.Contains("Tdie"))) 
                                  ?? hardware.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Temperature && s.Name.Contains("Core"));
                    
                    if (tempSensor != null) cpuTemp = tempSensor.Value.GetValueOrDefault();
                }

                // 3. Baca GPU (Multi-GPU & AMD Radeon RX 5700 XT Support!)
                if (hardware.HardwareType.ToString().Contains("Gpu"))
                {
                    gpuName = hardware.Name;
                    var gpuSensor = hardware.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Temperature && s.Name.Contains("Core"));
                    if (gpuSensor != null) gpuTemp = gpuSensor.Value.GetValueOrDefault();
                }

                // 4. Baca Memory (RAM)
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
            computer.Close();
        }
        catch (Exception ex)
        {
            // Abaikan error secara aman
        }

        // Ambil data WMI
        string moboSerial = GetWmiProperty("SELECT SerialNumber FROM Win32_BaseBoard", "SerialNumber");
        string cpuId = GetWmiProperty("SELECT ProcessorId FROM Win32_Processor", "ProcessorId");
        string gpuPnpId = GetWmiProperty("SELECT PNPDeviceID FROM Win32_VideoController", "PNPDeviceID");
        string[] ramSerials = GetRamSerials();
        string[] diskSerials = GetDiskSerials();

        string ramSerialsJson = "[" + string.Join(",", ramSerials.Select(s => "\"" + s + "\"")) + "]";
        string diskSerialsJson = "[" + string.Join(",", diskSerials.Select(s => "\"" + s + "\"")) + "]";

        // Tampilkan JSON flat ke stdout menggunakan string concatenation jadul yang handal
        Console.WriteLine(
            "{\"CpuUsage\":" + cpuLoad + 
            ",\"CpuTemp\":" + cpuTemp + 
            ",\"GpuTemp\":" + gpuTemp + 
            ",\"TotalRam\":\"" + ramInfo + 
            "\",\"Motherboard\":\"" + motherboard + 
            "\",\"CpuName\":\"" + cpuName + 
            "\",\"GpuName\":\"" + gpuName + "\"" +
            ",\"MotherboardSerial\":\"" + moboSerial + "\"" +
            ",\"CpuId\":\"" + cpuId + "\"" +
            ",\"GpuPnpId\":\"" + gpuPnpId + "\"" +
            ",\"RamSerials\":" + ramSerialsJson +
            ",\"DiskSerials\":" + diskSerialsJson +
            "}"
        );
    }
}
