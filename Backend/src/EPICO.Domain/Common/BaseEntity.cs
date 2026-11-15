namespace EPICO.Domain.Common;

public interface IEntidad
{
    Guid Id { get; set; }
}

/// <summary>Registro que pertenece a una razón social: la API lo filtra por los accesos del usuario.</summary>
public interface IDeEmpresa
{
    Guid EmpresaId { get; set; }
}

/// <summary>Registro que pertenece a una organización (compartido entre sus razones sociales).</summary>
public interface IDeOrganizacion
{
    Guid OrganizacionId { get; set; }
}

/// <summary>Compartido con la organización salvo que se limite a una razón social (vacío = todas).</summary>
public interface IRestringible
{
    Guid? EmpresaRestringidaId { get; set; }
}

/// <summary>Línea de un documento: sus cambios se anotan también en el hilo del padre (RegistroPadre de Evento).</summary>
public interface IDePadre
{
    string PadreTipo { get; }
    Guid PadreId { get; }
}

/// <summary>Campo rastreado: cada cambio queda en EventoCambio (como tracking=True en Odoo).</summary>
[AttributeUsage(AttributeTargets.Property)]
public sealed class RastreadoAttribute(string etiqueta) : Attribute
{
    /// <summary>Con tipo explícito; sin él se deduce del tipo de la propiedad. Dinero hay que indicarlo.</summary>
    public RastreadoAttribute(string etiqueta, TipoDatoCambio tipo) : this(etiqueta) => Tipo = tipo;

    public string Etiqueta { get; } = etiqueta;
    public TipoDatoCambio? Tipo { get; }
}

/// <summary>Base de las tablas del esquema. Las columnas se llenan solas en AppDbContext.SaveChangesAsync.</summary>
public abstract class BaseEntity : IEntidad
{
    public Guid Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public Guid? CreatedById { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid? UpdatedById { get; set; }
    public bool IsDeleted { get; set; }
}
