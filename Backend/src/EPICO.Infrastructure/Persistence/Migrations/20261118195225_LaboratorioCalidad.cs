using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EPICO.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LaboratorioCalidad : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MuestraLaboratorio",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Folio = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    PedidoId = table.Column<Guid>(type: "uuid", nullable: false),
                    RemisionId = table.Column<Guid>(type: "uuid", nullable: true),
                    FechaMuestreo = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RevenimientoCm = table.Column<decimal>(type: "numeric(5,1)", precision: 5, scale: 1, nullable: true),
                    TemperaturaC = table.Column<decimal>(type: "numeric(5,1)", precision: 5, scale: 1, nullable: true),
                    Cilindros = table.Column<int>(type: "integer", nullable: false),
                    ResistenciaDisenoKgCm2 = table.Column<int>(type: "integer", nullable: false),
                    LaboratoristaNombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Notas = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MuestraLaboratorio", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MuestraLaboratorio_Pedido_PedidoId",
                        column: x => x.PedidoId,
                        principalTable: "Pedido",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MuestraLaboratorio_Remision_RemisionId",
                        column: x => x.RemisionId,
                        principalTable: "Remision",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MuestraLaboratorio_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MuestraLaboratorio_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "EnsayeLaboratorio",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MuestraId = table.Column<Guid>(type: "uuid", nullable: false),
                    EdadDias = table.Column<int>(type: "integer", nullable: false),
                    FechaProgramada = table.Column<DateOnly>(type: "date", nullable: false),
                    FechaEnsaye = table.Column<DateOnly>(type: "date", nullable: true),
                    ResistenciaKgCm2 = table.Column<decimal>(type: "numeric(7,1)", precision: 7, scale: 1, nullable: true),
                    LaboratoristaNombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EnsayeLaboratorio", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EnsayeLaboratorio_MuestraLaboratorio_MuestraId",
                        column: x => x.MuestraId,
                        principalTable: "MuestraLaboratorio",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EnsayeLaboratorio_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EnsayeLaboratorio_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EnsayeLaboratorio_CreatedById",
                table: "EnsayeLaboratorio",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_EnsayeLaboratorio_FechaProgramada",
                table: "EnsayeLaboratorio",
                column: "FechaProgramada");

            migrationBuilder.CreateIndex(
                name: "IX_EnsayeLaboratorio_MuestraId_EdadDias",
                table: "EnsayeLaboratorio",
                columns: new[] { "MuestraId", "EdadDias" });

            migrationBuilder.CreateIndex(
                name: "IX_EnsayeLaboratorio_UpdatedById",
                table: "EnsayeLaboratorio",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_MuestraLaboratorio_CreatedById",
                table: "MuestraLaboratorio",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_MuestraLaboratorio_Folio",
                table: "MuestraLaboratorio",
                column: "Folio");

            migrationBuilder.CreateIndex(
                name: "IX_MuestraLaboratorio_PedidoId",
                table: "MuestraLaboratorio",
                column: "PedidoId");

            migrationBuilder.CreateIndex(
                name: "IX_MuestraLaboratorio_RemisionId",
                table: "MuestraLaboratorio",
                column: "RemisionId");

            migrationBuilder.CreateIndex(
                name: "IX_MuestraLaboratorio_UpdatedById",
                table: "MuestraLaboratorio",
                column: "UpdatedById");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EnsayeLaboratorio");

            migrationBuilder.DropTable(
                name: "MuestraLaboratorio");
        }
    }
}
