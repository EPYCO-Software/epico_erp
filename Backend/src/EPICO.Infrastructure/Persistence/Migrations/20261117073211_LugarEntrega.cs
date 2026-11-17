using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EPICO.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LugarEntrega : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "ObraId",
                table: "Pedido",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<string>(
                name: "EntregaDireccion",
                table: "Pedido",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "EntregaLat",
                table: "Pedido",
                type: "numeric(9,6)",
                precision: 9,
                scale: 6,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "EntregaLng",
                table: "Pedido",
                type: "numeric(9,6)",
                precision: 9,
                scale: 6,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EntregaMunicipio",
                table: "Pedido",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EntregaReferencias",
                table: "Pedido",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EntregaDireccion",
                table: "Cotizacion",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "EntregaLat",
                table: "Cotizacion",
                type: "numeric(9,6)",
                precision: 9,
                scale: 6,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "EntregaLng",
                table: "Cotizacion",
                type: "numeric(9,6)",
                precision: 9,
                scale: 6,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EntregaMunicipio",
                table: "Cotizacion",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EntregaReferencias",
                table: "Cotizacion",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EntregaDireccion",
                table: "Pedido");

            migrationBuilder.DropColumn(
                name: "EntregaLat",
                table: "Pedido");

            migrationBuilder.DropColumn(
                name: "EntregaLng",
                table: "Pedido");

            migrationBuilder.DropColumn(
                name: "EntregaMunicipio",
                table: "Pedido");

            migrationBuilder.DropColumn(
                name: "EntregaReferencias",
                table: "Pedido");

            migrationBuilder.DropColumn(
                name: "EntregaDireccion",
                table: "Cotizacion");

            migrationBuilder.DropColumn(
                name: "EntregaLat",
                table: "Cotizacion");

            migrationBuilder.DropColumn(
                name: "EntregaLng",
                table: "Cotizacion");

            migrationBuilder.DropColumn(
                name: "EntregaMunicipio",
                table: "Cotizacion");

            migrationBuilder.DropColumn(
                name: "EntregaReferencias",
                table: "Cotizacion");

            migrationBuilder.AlterColumn<Guid>(
                name: "ObraId",
                table: "Pedido",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
