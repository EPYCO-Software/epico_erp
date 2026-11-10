using EPICO.Domain.Common;

namespace EPICO.Domain.Crm;

public class Customer : BaseEntity
{
    public string CompanyName { get; set; } = string.Empty;
    public string ComercialName { get; set; } = string.Empty;
    public string? RFC { get; set; }
    public string? RegimenFiscal { get; set; }
    public string? CPFiscal { get; set; }
    public Guid? LogoFileId { get; set; }
    public string ZonaHoraria { get; set; } = "America/Mexico_City";
    public Guid? CsdCerFileId { get; set; }
    public Guid? CsdKeyFileId { get; set; }
    public string? CsdPasswordEncrypted { get; set; }
    public DateTime? CsdExpirationDate { get; set; }
    public bool HasCsd => CsdCerFileId != null && CsdKeyFileId != null && CsdExpirationDate != null;
}