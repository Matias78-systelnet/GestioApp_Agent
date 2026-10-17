using GestioApp.Contracts;
using System.Text.Json;
namespace GestioApp.Agent;

// Solo el servicio escribe; la interfaz tiene acceso de lectura.
public sealed class StateStore
{
    private readonly object gate = new();
    private AgentState state = new(DateTimeOffset.UtcNow, null, "Pendiente de lectura", null, null);
    public Guid DeviceId { get; }
    public StateStore()
    {
        var dir = Path.GetDirectoryName(Files.State)!;
        Directory.CreateDirectory(dir);
        var idFile = Path.Combine(dir, "device-id.txt");
        if (File.Exists(idFile))
            DeviceId = Guid.Parse(File.ReadAllText(idFile).Trim());
        else
        {
            DeviceId = Guid.NewGuid();
            File.WriteAllText(idFile, DeviceId.ToString());
        }
        if (File.Exists(Files.State))
        {
            try { state = JsonSerializer.Deserialize<AgentState>(File.ReadAllText(Files.State), Files.Json) ?? state; }
            catch (JsonException) { /* Un estado incompleto no impide volver a recoger inventario. */ }
        }
    }
    public void Update(Inventory? inventory = null, string? status = null, Guid? acceptedId = null)
    {
        lock (gate)
        {
            state = state with {
                ServiceSeenAtUtc = DateTimeOffset.UtcNow,
                Inventory = inventory ?? state.Inventory,
                SendStatus = status ?? state.SendStatus,
                LastAcceptedInventoryId = acceptedId ?? state.LastAcceptedInventoryId,
                LastAcceptedAtUtc = acceptedId.HasValue ? DateTimeOffset.UtcNow : state.LastAcceptedAtUtc
            };
            string temp = Files.State + ".tmp";
            File.WriteAllText(temp, JsonSerializer.Serialize(state, Files.Json));
            File.Move(temp, Files.State, true);
        }
    }
}
