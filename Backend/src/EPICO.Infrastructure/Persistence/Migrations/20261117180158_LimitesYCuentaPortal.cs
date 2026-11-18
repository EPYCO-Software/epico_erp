using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EPICO.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LimitesYCuentaPortal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LimiteCotizaciones",
                table: "Cliente",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LimiteObras",
                table: "Cliente",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LimiteCotizaciones",
                table: "Cliente");

            migrationBuilder.DropColumn(
                name: "LimiteObras",
                table: "Cliente");
        }
    }
}
