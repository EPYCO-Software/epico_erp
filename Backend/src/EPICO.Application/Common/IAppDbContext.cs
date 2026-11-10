using EPICO.Domain.Crm;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Application.Common;

public interface IAppDbContext
{
    DbSet<Customer> Customers { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}