namespace EPICO.Contracts.Crm;

// What the API returns
public record CustomerDTO(
    Guid Id,
    string CompanyName,
    string ComercialName,
    string? RFC,
    string? RegimenFiscal,
    string? CPFiscal,
    Guid? LogoFileId,
    string ZonaHoraria,
    bool HasCsd,                    // true if the .cer, .key and password are all set
    DateTime? CsdExpirationDate,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

// POST: create
public record CreateCustomerRequest(
    string CompanyName,
    string ComercialName,
    string? RFC,
    string? RegimenFiscal,
    string? CPFiscal,
    Guid? LogoFileId,
    string? ZonaHoraria);           // null → the default "America/Mexico_City"

// PUT: update
public record UpdateCustomerRequest(
    string CompanyName,
    string ComercialName,
    string? RFC,
    string? RegimenFiscal,
    string? CPFiscal,
    Guid? LogoFileId,
    string ZonaHoraria);

// PUT api/crm/customers/{id}/csd: separate endpoint for the sensitive data
public record SetCustomerCsdRequest(
    Guid CsdCerFileId,
    Guid CsdKeyFileId,
    string CsdPassword,             // plain text over HTTPS; encrypted server-side
    DateTime CsdExpirationDate);