using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EPICO.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ObrasGenerales : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "ClienteId",
                table: "Obra",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "EmpresaRestringidaId",
                table: "Obra",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizacionId",
                table: "Obra",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            // Las obras existentes son de la organización de su cliente.
            migrationBuilder.Sql("""UPDATE "Obra" o SET "OrganizacionId" = c."OrganizacionId" FROM "Cliente" c WHERE c."Id" = o."ClienteId";""");
            // /obras pasa de ventas.clientes.* a ventas.obras.*: quien tenía lo de clientes recibe lo mismo de obras.
            migrationBuilder.Sql("""
                INSERT INTO "RolPermiso" ("Id", "RolId", "Permiso")
                SELECT gen_random_uuid(), x."RolId", replace(x."Permiso", 'ventas.clientes.', 'ventas.obras.')
                FROM "RolPermiso" x
                WHERE x."Permiso" LIKE 'ventas.clientes.%' AND NOT EXISTS (SELECT 1 FROM "RolPermiso" y
                    WHERE y."RolId" = x."RolId" AND y."Permiso" = replace(x."Permiso", 'ventas.clientes.', 'ventas.obras.'));
                INSERT INTO "UsuarioPermiso" ("Id", "UsuarioId", "Permiso", "Quitado")
                SELECT gen_random_uuid(), x."UsuarioId", replace(x."Permiso", 'ventas.clientes.', 'ventas.obras.'), x."Quitado"
                FROM "UsuarioPermiso" x
                WHERE x."Permiso" LIKE 'ventas.clientes.%' AND NOT EXISTS (SELECT 1 FROM "UsuarioPermiso" y
                    WHERE y."UsuarioId" = x."UsuarioId" AND y."Permiso" = replace(x."Permiso", 'ventas.clientes.', 'ventas.obras.'));
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Obra_EmpresaRestringidaId",
                table: "Obra",
                column: "EmpresaRestringidaId");

            migrationBuilder.CreateIndex(
                name: "IX_Obra_OrganizacionId_Nombre",
                table: "Obra",
                columns: new[] { "OrganizacionId", "Nombre" });

            migrationBuilder.AddForeignKey(
                name: "FK_Obra_Empresa_EmpresaRestringidaId",
                table: "Obra",
                column: "EmpresaRestringidaId",
                principalTable: "Empresa",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Obra_Organizacion_OrganizacionId",
                table: "Obra",
                column: "OrganizacionId",
                principalTable: "Organizacion",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Obra_Empresa_EmpresaRestringidaId",
                table: "Obra");

            migrationBuilder.DropForeignKey(
                name: "FK_Obra_Organizacion_OrganizacionId",
                table: "Obra");

            migrationBuilder.DropIndex(
                name: "IX_Obra_EmpresaRestringidaId",
                table: "Obra");

            migrationBuilder.DropIndex(
                name: "IX_Obra_OrganizacionId_Nombre",
                table: "Obra");

            migrationBuilder.DropColumn(
                name: "EmpresaRestringidaId",
                table: "Obra");

            migrationBuilder.DropColumn(
                name: "OrganizacionId",
                table: "Obra");

            migrationBuilder.AlterColumn<Guid>(
                name: "ClienteId",
                table: "Obra",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
