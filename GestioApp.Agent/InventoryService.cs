using GestioApp.Contracts;
using System.Management;
namespace GestioApp.Agent;

public sealed class InventoryService(StateStore store)
{
    public Inventory Read()
    {
        var errors = new List<string>();
        string[] Query(string cls, string prop)
        {
            var values = new List<string>();
            try
            {
                using var search = new ManagementObjectSearcher("root\\CIMV2", $"SELECT {prop} FROM {cls}");
                search.Options.Timeout = TimeSpan.FromSeconds(15);
                using var results = search.Get();
                foreach (ManagementObject row in results)
                    using (row)
                    {
                        var value = row[prop]?.ToString()?.Trim();
                        if (!string.IsNullOrWhiteSpace(value)) values.Add(value);
                    }
            }
            catch (Exception ex) { errors.Add($"{cls}: {ex.GetType().Name}"); }
            return values.ToArray();
        }
        var cpu = Query("Win32_Processor", "Name");
        var serial = Query("Win32_BIOS", "SerialNumber").FirstOrDefault();
        // Nombre de la sesión de consola; NO Environment.UserName (cuenta del servicio).
        // No representa sesiones RDP ni el responsable asignado al dispositivo.
        var user = Query("Win32_ComputerSystem", "UserName").FirstOrDefault();
        var capacities = Query("Win32_PhysicalMemory", "Capacity");
        ulong? ram = capacities.Length == 0 ? null : 0UL;
        foreach (var item in capacities)
        {
            if (!ulong.TryParse(item, out var bytes)) { ram = null; break; }
            ram += bytes;
        }
        var volumes = new List<VolumeReading>();
        foreach (var drive in DriveInfo.GetDrives())
        {
            try
            {
                if (drive.DriveType == DriveType.Fixed && drive.IsReady)
                    volumes.Add(new(drive.Name, drive.TotalSize, drive.TotalFreeSpace));
            }
            catch (Exception ex) { errors.Add($"Volumen {drive.Name}: {ex.GetType().Name}"); }
        }
        return new(1, Guid.NewGuid(), store.DeviceId, Environment.MachineName, DateTimeOffset.UtcNow,
            cpu, ram, serial, user, volumes.ToArray(), errors.ToArray());
    }
}
