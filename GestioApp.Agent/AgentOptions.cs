namespace GestioApp.Agent;
public sealed class AgentOptions
{
    public bool ApiEnabled { get; set; } = false;
    public string InventoryEndpoint { get; set; } = "";
    public string HeartbeatEndpoint { get; set; } = "";
    public int InventorySeconds { get; set; } = 300;
    public int HeartbeatSeconds { get; set; } = 60;
    public bool ActivityEnabled { get; set; } = true;
    public bool ActivityApiEnabled { get; set; } = false;
    public string ActivityEndpoint { get; set; } = "";
    public void Validate()
    {
        if (InventorySeconds < 30 || HeartbeatSeconds < 15)
            throw new InvalidOperationException("Intervalos mínimos: inventario 30 s; heartbeat 15 s.");
        if (ActivityApiEnabled && (!ActivityEnabled || !Uri.TryCreate(ActivityEndpoint, UriKind.Absolute, out var activityUri)
            || activityUri.Scheme != "https" || !string.IsNullOrEmpty(activityUri.UserInfo)))
            throw new InvalidOperationException("Actividad requiere ActivityEnabled y endpoint HTTPS válido.");
        if (ApiEnabled)
            foreach (var url in new[] { InventoryEndpoint, HeartbeatEndpoint })
                if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != "https" || !string.IsNullOrEmpty(uri.UserInfo))
                    throw new InvalidOperationException("La API requiere endpoints HTTPS válidos sin credenciales en la URL.");
    }
}
