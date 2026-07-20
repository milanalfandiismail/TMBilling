using System;
using System.IO;
using System.Linq;
using System.Globalization;
using LibreHardwareMonitor.Hardware;

class Program
{
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

        // Tampilkan JSON flat ke stdout menggunakan string concatenation jadul yang handal
        Console.WriteLine(
            "{\"CpuUsage\":" + cpuLoad + 
            ",\"CpuTemp\":" + cpuTemp + 
            ",\"GpuTemp\":" + gpuTemp + 
            ",\"TotalRam\":\"" + ramInfo + 
            "\",\"Motherboard\":\"" + motherboard + 
            "\",\"CpuName\":\"" + cpuName + 
            "\",\"GpuName\":\"" + gpuName + "\"" +
            "}"
        );
    }
}
