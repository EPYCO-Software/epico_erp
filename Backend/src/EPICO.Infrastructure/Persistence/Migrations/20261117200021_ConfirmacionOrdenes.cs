using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EPICO.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ConfirmacionOrdenes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ConfirmadaEn",
                table: "Pedido",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ConfirmadaPorId",
                table: "Pedido",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Pedido_ConfirmadaPorId",
                table: "Pedido",
                column: "ConfirmadaPorId");

            migrationBuilder.AddForeignKey(
                name: "FK_Pedido_Usuario_ConfirmadaPorId",
                table: "Pedido",
                column: "ConfirmadaPorId",
                principalTable: "Usuario",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // Lo de antes: ya confirmadas si la planta confirmó o ya salió de programado (quién, no se sabe).
            migrationBuilder.Sql("""
                UPDATE "Pedido" SET "ConfirmadaEn" = COALESCE("UpdatedAt", "CreatedAt")
                WHERE "EstatusPlanta" = 'confirmado' OR "Estado" <> 'programado';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Pedido_Usuario_ConfirmadaPorId",
                table: "Pedido");

            migrationBuilder.DropIndex(
                name: "IX_Pedido_ConfirmadaPorId",
                table: "Pedido");

            migrationBuilder.DropColumn(
                name: "ConfirmadaEn",
                table: "Pedido");

            migrationBuilder.DropColumn(
                name: "ConfirmadaPorId",
                table: "Pedido");
        }
    }
}
