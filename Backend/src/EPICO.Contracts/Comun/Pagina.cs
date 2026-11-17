namespace EPICO.Contracts.Comun;

/// <summary>Una página de resultados y el total que cumple los filtros.</summary>
public record Pagina<T>(IReadOnlyList<T> Items, int Total);

/// <summary>Página de notificaciones con el total de no leídas (para el globo de la campana).</summary>
public record PaginaNotificaciones<T>(IReadOnlyList<T> Items, int Total, int NoLeidas);
