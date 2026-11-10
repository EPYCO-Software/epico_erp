using EPICO.Application.Common;
using EPICO.Contracts.Crm;
using EPICO.Domain.Crm;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Api.Controllers;

[ApiController]
[Route("api/v1/crm/customers")]
// [Authorize]
public class CustomerController(IAppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<CustomerDTO>>> GetAll(CancellationToken ct) =>
        await db.Customers.AsNoTracking()
            .Select(c => new CustomerDTO(c.Id, c.CompanyName, c.ComercialName,
            c.RFC, c.RegimenFiscal, c.CPFiscal, c.LogoFileId,
            c.ZonaHoraria, c.HasCsd,
            c.CsdExpirationDate, c.CreatedAt, c.UpdatedAt))
            .ToListAsync(ct);

    [HttpPost]
    public async Task<ActionResult<CustomerDTO>> Create(CreateCustomerRequest r, CancellationToken ct)
    {
        var c = new Customer
        {
            CompanyName = r.CompanyName,
            ComercialName = r.ComercialName,
            RFC = r.RFC,
            RegimenFiscal = r.RegimenFiscal,
            CPFiscal = r.CPFiscal,
            LogoFileId = r.LogoFileId,
            ZonaHoraria = r.ZonaHoraria ?? "America/Mexico_City"
        };
        db.Customers.Add(c);
        await db.SaveChangesAsync(ct);
        return Created($"api/crm/customers/{c.Id}",
            new CustomerDTO(c.Id, c.CompanyName, c.ComercialName, c.RFC,
            c.RegimenFiscal, c.CPFiscal, c.LogoFileId, c.ZonaHoraria,
            c.HasCsd, c.CsdExpirationDate, c.CreatedAt, c.UpdatedAt));
    }
}