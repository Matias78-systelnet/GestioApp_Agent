using System.Text.Json;
namespace GestioApp.Contracts;

// Contrato compartido por el servicio, la interfaz y el receptor de la API.
public sealed record VolumeReading(string Name, long TotalBytes, long FreeBytes);
public sealed record Inventory(
    int SchemaVersion, Guid InventoryId, Guid DeviceId, string ComputerName,
    DateTimeOffset CollectedAtUtc, string[] CpuModels, ulong? RamInstalledBytes,
    string? SerialNumber, string? ConsoleUser, VolumeReading[] Volumes, string[] Errors);

public sealed record AgentState(
    DateTimeOffset ServiceSeenAtUtc, Inventory? Inventory, string SendStatus,
    Guid? LastAcceptedInventoryId, DateTimeOffset? LastAcceptedAtUtc);

public static class Files
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    public static string Root => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "GestioApp");
    public static string State => Path.Combine(Root, "State", "state.json");
    public static string Config => Path.Combine(Root, "Config", "agent.json");
    public static string Token => Path.Combine(Root, "Config", "api-token.txt");
}
