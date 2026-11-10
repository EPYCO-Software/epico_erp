using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EPICO.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialPostgres : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Customers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyName = table.Column<string>(type: "text", nullable: false),
                    ComercialName = table.Column<string>(type: "text", nullable: false),
                    RFC = table.Column<string>(type: "text", nullable: true),
                    RegimenFiscal = table.Column<string>(type: "text", nullable: true),
                    CPFiscal = table.Column<string>(type: "text", nullable: true),
                    LogoFileId = table.Column<Guid>(type: "uuid", nullable: true),
                    ZonaHoraria = table.Column<string>(type: "text", nullable: false),
                    CsdCerFileId = table.Column<Guid>(type: "uuid", nullable: true),
                    CsdKeyFileId = table.Column<Guid>(type: "uuid", nullable: true),
                    CsdPasswordEncrypted = table.Column<string>(type: "text", nullable: true),
                    CsdExpirationDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Customers", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Customers");
        }
    }
}
