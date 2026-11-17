using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EPICO.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RolPorUsuario : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "RolId",
                table: "Usuario",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Usuario_RolId",
                table: "Usuario",
                column: "RolId");

            migrationBuilder.AddForeignKey(
                name: "FK_Usuario_Rol_RolId",
                table: "Usuario",
                column: "RolId",
                principalTable: "Rol",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // El rol del usuario = el de su acceso predeterminado (o el primero); después se quita del acceso.
            migrationBuilder.Sql("""
                UPDATE "Usuario" u SET "RolId" = (
                    SELECT a."RolId" FROM "UsuarioAcceso" a WHERE a."UsuarioId" = u."Id"
                    ORDER BY a."Predeterminado" DESC, a."Id" LIMIT 1)
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_UsuarioAcceso_Rol_RolId",
                table: "UsuarioAcceso");

            migrationBuilder.DropIndex(
                name: "IX_UsuarioAcceso_RolId",
                table: "UsuarioAcceso");

            migrationBuilder.DropColumn(
                name: "RolId",
                table: "UsuarioAcceso");

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Usuario_Rol_RolId",
                table: "Usuario");

            migrationBuilder.DropIndex(
                name: "IX_Usuario_RolId",
                table: "Usuario");

            migrationBuilder.DropColumn(
                name: "RolId",
                table: "Usuario");

            migrationBuilder.AddColumn<Guid>(
                name: "RolId",
                table: "UsuarioAcceso",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_UsuarioAcceso_RolId",
                table: "UsuarioAcceso",
                column: "RolId");

            migrationBuilder.AddForeignKey(
                name: "FK_UsuarioAcceso_Rol_RolId",
                table: "UsuarioAcceso",
                column: "RolId",
                principalTable: "Rol",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
