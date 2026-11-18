using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EPICO.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class NegociacionYCredito : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CreditoDesde",
                table: "Pedido",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReemplazaId",
                table: "Cotizacion",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReemplazadaPorId",
                table: "Cotizacion",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Cotizacion_ReemplazadaPorId",
                table: "Cotizacion",
                column: "ReemplazadaPorId");

            migrationBuilder.CreateIndex(
                name: "IX_Cotizacion_ReemplazaId",
                table: "Cotizacion",
                column: "ReemplazaId");

            migrationBuilder.AddForeignKey(
                name: "FK_Cotizacion_Cotizacion_ReemplazaId",
                table: "Cotizacion",
                column: "ReemplazaId",
                principalTable: "Cotizacion",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Cotizacion_Cotizacion_ReemplazadaPorId",
                table: "Cotizacion",
                column: "ReemplazadaPorId",
                principalTable: "Cotizacion",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Cotizacion_Cotizacion_ReemplazaId",
                table: "Cotizacion");

            migrationBuilder.DropForeignKey(
                name: "FK_Cotizacion_Cotizacion_ReemplazadaPorId",
                table: "Cotizacion");

            migrationBuilder.DropIndex(
                name: "IX_Cotizacion_ReemplazadaPorId",
                table: "Cotizacion");

            migrationBuilder.DropIndex(
                name: "IX_Cotizacion_ReemplazaId",
                table: "Cotizacion");

            migrationBuilder.DropColumn(
                name: "CreditoDesde",
                table: "Pedido");

            migrationBuilder.DropColumn(
                name: "ReemplazaId",
                table: "Cotizacion");

            migrationBuilder.DropColumn(
                name: "ReemplazadaPorId",
                table: "Cotizacion");
        }
    }
}
