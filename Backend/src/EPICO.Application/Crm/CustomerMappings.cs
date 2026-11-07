using EPICO.Contracts.Crm;
using EPICO.Domain.Crm;

namespace EPICO.Application.Crm;

public static class CustomerMappings
{
    public static CustomerDTO ToDto(this Customer c) => new(
        c.Id, c.CompanyName, c.ComercialName, c.RFC, c.RegimenFiscal, c.CPFiscal,
        c.LogoFileId, c.ZonaHoraria, c.HasCsd,
        c.CsdExpirationDate, c.CreatedAt, c.UpdatedAt);

    public static Customer ToEntity(this CreateCustomerRequest r) => new()
    {
        CompanyName = r.CompanyName,
        ComercialName = r.ComercialName,
        RFC = r.RFC?.Trim().ToUpperInvariant(),
        RegimenFiscal = r.RegimenFiscal,
        CPFiscal = r.CPFiscal,
        LogoFileId = r.LogoFileId,
        ZonaHoraria = r.ZonaHoraria ?? "America/Mexico_City"
    };

    public static void Apply(this Customer c, UpdateCustomerRequest r)
    {
        c.CompanyName = r.CompanyName;
        c.ComercialName = r.ComercialName;
        c.RFC = r.RFC?.Trim().ToUpperInvariant();
        c.RegimenFiscal = r.RegimenFiscal;
        c.CPFiscal = r.CPFiscal;
        c.LogoFileId = r.LogoFileId;
        c.ZonaHoraria = r.ZonaHoraria;
    }
}