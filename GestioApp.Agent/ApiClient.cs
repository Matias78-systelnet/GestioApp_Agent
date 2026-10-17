using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using GestioApp.Contracts;
namespace GestioApp.Agent;

// El servidor debe vincular este token a DeviceId. DeviceId por sí solo NO autentica.
public sealed class ApiClient : IDisposable
{
    private readonly HttpClient http = new(new HttpClientHandler { AllowAutoRedirect = false })
        { Timeout = TimeSpan.FromSeconds(20) };
    public async Task<string?> SendAsync<T>(string endpoint, T payload, CancellationToken ct)
    {
        try
        {
            string token = (await File.ReadAllTextAsync(Files.Token, ct)).Trim();
            if (string.IsNullOrWhiteSpace(token)) return "Token no configurado";
            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            request.Content = new StringContent(JsonSerializer.Serialize(payload, Files.Json), Encoding.UTF8, "application/json");
            using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
            return response.IsSuccessStatusCode ? null : $"API HTTP {(int)response.StatusCode}";
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (OperationCanceledException) { return "Tiempo de espera agotado"; }
        catch (HttpRequestException) { return "Sin comunicación con la API"; }
        catch (IOException) { return "No se pudo leer el token"; }
        catch (UnauthorizedAccessException) { return "Sin permiso para leer el token"; }
        catch (FormatException) { return "Formato de token inválido"; }
    }
    public async Task<string?> SendActivityAsync(string endpoint, ActivityEnvelope payload, CancellationToken ct)
    {
        try
        {
            string token = (await File.ReadAllTextAsync(Files.Token, ct)).Trim();
            if (string.IsNullOrWhiteSpace(token)) return "Token no configurado";
            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            request.Content = new StringContent(JsonSerializer.Serialize(payload, ActivityProtocol.Json), Encoding.UTF8, "application/json");
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(20));
            using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
            if (response.StatusCode != System.Net.HttpStatusCode.OK) return $"API HTTP {(int)response.StatusCode}";
            using var body = await response.Content.ReadAsStreamAsync(timeout.Token);
            using var limited = new MemoryStream();
            byte[] buffer = new byte[1024];
            int read;
            while ((read = await body.ReadAsync(buffer, timeout.Token)) > 0)
            {
                if (limited.Length + read > 4096) return "Acuse demasiado grande";
                limited.Write(buffer, 0, read);
            }
            using var json = JsonDocument.Parse(limited.ToArray());
            return json.RootElement.TryGetProperty("batchId", out var id) && id.ValueKind == JsonValueKind.String
                && Guid.TryParse(id.GetString(), out var value) && value == payload.Activity.BatchId
                ? null : "API sin confirmación del batchId";
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception ex) when (ex is OperationCanceledException or HttpRequestException or IOException
            or UnauthorizedAccessException or FormatException or JsonException or InvalidOperationException)
        { return "No confirmado: " + ex.GetType().Name; }
    }
    public void Dispose() => http.Dispose();
}
