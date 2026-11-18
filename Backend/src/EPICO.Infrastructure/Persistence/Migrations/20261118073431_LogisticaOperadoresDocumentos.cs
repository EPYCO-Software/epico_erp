using System;
using EPICO.Domain.Common;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EPICO.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LogisticaOperadoresDocumentos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Remision_Usuario_OperadorId",
                table: "Remision");

            // OperadorId apuntaba a Usuario (nunca se usó); ahora es del catálogo de operadores.
            migrationBuilder.Sql("UPDATE \"Remision\" SET \"OperadorId\" = NULL;");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:aplicar_regla", "categoria,producto,todos")
                .Annotation("Npgsql:Enum:estado_cobro", "credito,facturado,finalizado,pagado,por_cobrar,por_facturar")
                .Annotation("Npgsql:Enum:estado_correo", "enviado,fallido,pendiente")
                .Annotation("Npgsql:Enum:estado_cotizacion", "borrador,cancelada,enviada,pedido,recibida")
                .Annotation("Npgsql:Enum:estado_equipo", "disponible,fuera_de_servicio,mantenimiento")
                .Annotation("Npgsql:Enum:estado_mantenimiento", "cancelado,en_proceso,programado,terminado")
                .Annotation("Npgsql:Enum:estado_pedido", "cancelado,en_obra,en_planta,en_ruta,entregado,programado")
                .Annotation("Npgsql:Enum:estado_viaje", "cargando,en_obra,en_ruta,programado,regresando,terminado")
                .Annotation("Npgsql:Enum:estatus_planta", "actualizacion,confirmado,enviado,no_enviado,rechazada")
                .Annotation("Npgsql:Enum:etapa_prospecto", "calificado,contactado,ganado,nuevo,perdido,propuesta")
                .Annotation("Npgsql:Enum:metodo_pago", "cheque,efectivo,sin_metodo,tarjeta,transferencia")
                .Annotation("Npgsql:Enum:origen_cotizacion", "erp,portal")
                .Annotation("Npgsql:Enum:seguridad_smtp", "ninguna,ssl,start_tls")
                .Annotation("Npgsql:Enum:tipo_actividad", "correo,documento,llamada,pendiente,reunion")
                .Annotation("Npgsql:Enum:tipo_dato_cambio", "booleano,dinero,fecha,fecha_hora,numero,opcion,referencia,texto")
                .Annotation("Npgsql:Enum:tipo_documento_equipo", "otro,permiso_sct,seguro,tarjeta_circulacion,tenencia,verificacion")
                .Annotation("Npgsql:Enum:tipo_equipo", "allanadora,aplanadora,bomba_estacionaria,bomba_pluma,camioneta,cargador,excavadora,grua,montacargas,otro,pipa,plataforma,retroexcavadora,revolvedor,tractocamion,vibrador,volteo")
                .Annotation("Npgsql:Enum:tipo_evento", "actividad,cambio,creado,eliminado,mensaje,nota,restaurado,sistema")
                .Annotation("Npgsql:Enum:tipo_impuesto", "retencion,traslado")
                .Annotation("Npgsql:Enum:tipo_mantenimiento", "correctivo,preventivo")
                .Annotation("Npgsql:Enum:tipo_movimiento_inventario", "ajuste,entrada,salida")
                .Annotation("Npgsql:Enum:tipo_producto", "concreto,general,servicio")
                .Annotation("Npgsql:Enum:tipo_programa", "codigo,compra_x,cupones,lealtad,promocion,proxima_orden,sellos")
                .Annotation("Npgsql:Enum:tipo_recompensa", "monto,porcentaje,traslado")
                .Annotation("Npgsql:Enum:tipo_regla_precio", "descuento,fijo,formula")
                .Annotation("Npgsql:Enum:tipo_usuario", "interno,portal")
                .OldAnnotation("Npgsql:Enum:aplicar_regla", "categoria,producto,todos")
                .OldAnnotation("Npgsql:Enum:estado_cobro", "credito,facturado,finalizado,pagado,por_cobrar,por_facturar")
                .OldAnnotation("Npgsql:Enum:estado_correo", "enviado,fallido,pendiente")
                .OldAnnotation("Npgsql:Enum:estado_cotizacion", "borrador,cancelada,enviada,pedido,recibida")
                .OldAnnotation("Npgsql:Enum:estado_equipo", "disponible,fuera_de_servicio,mantenimiento")
                .OldAnnotation("Npgsql:Enum:estado_pedido", "cancelado,en_obra,en_planta,en_ruta,entregado,programado")
                .OldAnnotation("Npgsql:Enum:estado_viaje", "cargando,en_obra,en_ruta,programado,regresando,terminado")
                .OldAnnotation("Npgsql:Enum:estatus_planta", "actualizacion,confirmado,enviado,no_enviado,rechazada")
                .OldAnnotation("Npgsql:Enum:etapa_prospecto", "calificado,contactado,ganado,nuevo,perdido,propuesta")
                .OldAnnotation("Npgsql:Enum:metodo_pago", "cheque,efectivo,sin_metodo,tarjeta,transferencia")
                .OldAnnotation("Npgsql:Enum:origen_cotizacion", "erp,portal")
                .OldAnnotation("Npgsql:Enum:seguridad_smtp", "ninguna,ssl,start_tls")
                .OldAnnotation("Npgsql:Enum:tipo_actividad", "correo,documento,llamada,pendiente,reunion")
                .OldAnnotation("Npgsql:Enum:tipo_dato_cambio", "booleano,dinero,fecha,fecha_hora,numero,opcion,referencia,texto")
                .OldAnnotation("Npgsql:Enum:tipo_equipo", "allanadora,aplanadora,bomba_estacionaria,bomba_pluma,camioneta,cargador,excavadora,grua,montacargas,otro,pipa,plataforma,retroexcavadora,revolvedor,tractocamion,vibrador,volteo")
                .OldAnnotation("Npgsql:Enum:tipo_evento", "actividad,cambio,creado,eliminado,mensaje,nota,restaurado,sistema")
                .OldAnnotation("Npgsql:Enum:tipo_impuesto", "retencion,traslado")
                .OldAnnotation("Npgsql:Enum:tipo_movimiento_inventario", "ajuste,entrada,salida")
                .OldAnnotation("Npgsql:Enum:tipo_producto", "concreto,general,servicio")
                .OldAnnotation("Npgsql:Enum:tipo_programa", "codigo,compra_x,cupones,lealtad,promocion,proxima_orden,sellos")
                .OldAnnotation("Npgsql:Enum:tipo_recompensa", "monto,porcentaje,traslado")
                .OldAnnotation("Npgsql:Enum:tipo_regla_precio", "descuento,fijo,formula")
                .OldAnnotation("Npgsql:Enum:tipo_usuario", "interno,portal");

            migrationBuilder.AddColumn<Guid>(
                name: "OperadorId",
                table: "Equipo",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "UltimoHorometro",
                table: "Equipo",
                type: "numeric(10,1)",
                precision: 10,
                scale: 1,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "UltimoOdometroKm",
                table: "Equipo",
                type: "numeric(12,1)",
                precision: 12,
                scale: 1,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "DocumentoEquipo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EquipoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tipo = table.Column<TipoDocumentoEquipo>(type: "tipo_documento_equipo", nullable: false),
                    Numero = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    Vence = table.Column<DateOnly>(type: "date", nullable: true),
                    ArchivoId = table.Column<Guid>(type: "uuid", nullable: true),
                    Notas = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentoEquipo", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DocumentoEquipo_Archivo_ArchivoId",
                        column: x => x.ArchivoId,
                        principalTable: "Archivo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DocumentoEquipo_Equipo_EquipoId",
                        column: x => x.EquipoId,
                        principalTable: "Equipo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DocumentoEquipo_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DocumentoEquipo_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Mantenimiento",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EquipoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tipo = table.Column<TipoMantenimiento>(type: "tipo_mantenimiento", nullable: false),
                    Descripcion = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    ProgramadoPara = table.Column<DateOnly>(type: "date", nullable: true),
                    ProgramadoKm = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    Estado = table.Column<EstadoMantenimiento>(type: "estado_mantenimiento", nullable: false),
                    InicioEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FinEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Costo = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    Taller = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Notas = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Mantenimiento", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Mantenimiento_Equipo_EquipoId",
                        column: x => x.EquipoId,
                        principalTable: "Equipo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Mantenimiento_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Mantenimiento_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Operador",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganizacionId = table.Column<Guid>(type: "uuid", nullable: false),
                    SucursalId = table.Column<Guid>(type: "uuid", nullable: true),
                    Nombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Telefono = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    LicenciaNumero = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    LicenciaTipo = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: true),
                    LicenciaVence = table.Column<DateOnly>(type: "date", nullable: true),
                    Activo = table.Column<bool>(type: "boolean", nullable: false),
                    Notas = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Operador", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Operador_Organizacion_OrganizacionId",
                        column: x => x.OrganizacionId,
                        principalTable: "Organizacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Operador_Sucursal_SucursalId",
                        column: x => x.SucursalId,
                        principalTable: "Sucursal",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Operador_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Operador_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CargaCombustible",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EquipoId = table.Column<Guid>(type: "uuid", nullable: false),
                    SucursalId = table.Column<Guid>(type: "uuid", nullable: false),
                    Fecha = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Litros = table.Column<decimal>(type: "numeric(10,3)", precision: 10, scale: 3, nullable: false),
                    CostoTotal = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    OdometroKm = table.Column<decimal>(type: "numeric(12,1)", precision: 12, scale: 1, nullable: true),
                    Horometro = table.Column<decimal>(type: "numeric(10,1)", precision: 10, scale: 1, nullable: true),
                    OperadorId = table.Column<Guid>(type: "uuid", nullable: true),
                    Notas = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CargaCombustible", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CargaCombustible_Equipo_EquipoId",
                        column: x => x.EquipoId,
                        principalTable: "Equipo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CargaCombustible_Operador_OperadorId",
                        column: x => x.OperadorId,
                        principalTable: "Operador",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CargaCombustible_Sucursal_SucursalId",
                        column: x => x.SucursalId,
                        principalTable: "Sucursal",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CargaCombustible_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CargaCombustible_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Equipo_OperadorId",
                table: "Equipo",
                column: "OperadorId");

            migrationBuilder.CreateIndex(
                name: "IX_CargaCombustible_CreatedById",
                table: "CargaCombustible",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_CargaCombustible_EquipoId_Fecha",
                table: "CargaCombustible",
                columns: new[] { "EquipoId", "Fecha" });

            migrationBuilder.CreateIndex(
                name: "IX_CargaCombustible_OperadorId",
                table: "CargaCombustible",
                column: "OperadorId");

            migrationBuilder.CreateIndex(
                name: "IX_CargaCombustible_SucursalId",
                table: "CargaCombustible",
                column: "SucursalId");

            migrationBuilder.CreateIndex(
                name: "IX_CargaCombustible_UpdatedById",
                table: "CargaCombustible",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentoEquipo_ArchivoId",
                table: "DocumentoEquipo",
                column: "ArchivoId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentoEquipo_CreatedById",
                table: "DocumentoEquipo",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentoEquipo_EquipoId",
                table: "DocumentoEquipo",
                column: "EquipoId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentoEquipo_UpdatedById",
                table: "DocumentoEquipo",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Mantenimiento_CreatedById",
                table: "Mantenimiento",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Mantenimiento_EquipoId",
                table: "Mantenimiento",
                column: "EquipoId");

            migrationBuilder.CreateIndex(
                name: "IX_Mantenimiento_UpdatedById",
                table: "Mantenimiento",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Operador_CreatedById",
                table: "Operador",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Operador_OrganizacionId_Nombre",
                table: "Operador",
                columns: new[] { "OrganizacionId", "Nombre" });

            migrationBuilder.CreateIndex(
                name: "IX_Operador_SucursalId",
                table: "Operador",
                column: "SucursalId");

            migrationBuilder.CreateIndex(
                name: "IX_Operador_UpdatedById",
                table: "Operador",
                column: "UpdatedById");

            migrationBuilder.AddForeignKey(
                name: "FK_Equipo_Operador_OperadorId",
                table: "Equipo",
                column: "OperadorId",
                principalTable: "Operador",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Remision_Operador_OperadorId",
                table: "Remision",
                column: "OperadorId",
                principalTable: "Operador",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Equipo_Operador_OperadorId",
                table: "Equipo");

            migrationBuilder.DropForeignKey(
                name: "FK_Remision_Operador_OperadorId",
                table: "Remision");

            migrationBuilder.DropTable(
                name: "CargaCombustible");

            migrationBuilder.DropTable(
                name: "DocumentoEquipo");

            migrationBuilder.DropTable(
                name: "Mantenimiento");

            migrationBuilder.DropTable(
                name: "Operador");

            migrationBuilder.DropIndex(
                name: "IX_Equipo_OperadorId",
                table: "Equipo");

            migrationBuilder.DropColumn(
                name: "OperadorId",
                table: "Equipo");

            migrationBuilder.DropColumn(
                name: "UltimoHorometro",
                table: "Equipo");

            migrationBuilder.DropColumn(
                name: "UltimoOdometroKm",
                table: "Equipo");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:aplicar_regla", "categoria,producto,todos")
                .Annotation("Npgsql:Enum:estado_cobro", "credito,facturado,finalizado,pagado,por_cobrar,por_facturar")
                .Annotation("Npgsql:Enum:estado_correo", "enviado,fallido,pendiente")
                .Annotation("Npgsql:Enum:estado_cotizacion", "borrador,cancelada,enviada,pedido,recibida")
                .Annotation("Npgsql:Enum:estado_equipo", "disponible,fuera_de_servicio,mantenimiento")
                .Annotation("Npgsql:Enum:estado_pedido", "cancelado,en_obra,en_planta,en_ruta,entregado,programado")
                .Annotation("Npgsql:Enum:estado_viaje", "cargando,en_obra,en_ruta,programado,regresando,terminado")
                .Annotation("Npgsql:Enum:estatus_planta", "actualizacion,confirmado,enviado,no_enviado,rechazada")
                .Annotation("Npgsql:Enum:etapa_prospecto", "calificado,contactado,ganado,nuevo,perdido,propuesta")
                .Annotation("Npgsql:Enum:metodo_pago", "cheque,efectivo,sin_metodo,tarjeta,transferencia")
                .Annotation("Npgsql:Enum:origen_cotizacion", "erp,portal")
                .Annotation("Npgsql:Enum:seguridad_smtp", "ninguna,ssl,start_tls")
                .Annotation("Npgsql:Enum:tipo_actividad", "correo,documento,llamada,pendiente,reunion")
                .Annotation("Npgsql:Enum:tipo_dato_cambio", "booleano,dinero,fecha,fecha_hora,numero,opcion,referencia,texto")
                .Annotation("Npgsql:Enum:tipo_equipo", "allanadora,aplanadora,bomba_estacionaria,bomba_pluma,camioneta,cargador,excavadora,grua,montacargas,otro,pipa,plataforma,retroexcavadora,revolvedor,tractocamion,vibrador,volteo")
                .Annotation("Npgsql:Enum:tipo_evento", "actividad,cambio,creado,eliminado,mensaje,nota,restaurado,sistema")
                .Annotation("Npgsql:Enum:tipo_impuesto", "retencion,traslado")
                .Annotation("Npgsql:Enum:tipo_movimiento_inventario", "ajuste,entrada,salida")
                .Annotation("Npgsql:Enum:tipo_producto", "concreto,general,servicio")
                .Annotation("Npgsql:Enum:tipo_programa", "codigo,compra_x,cupones,lealtad,promocion,proxima_orden,sellos")
                .Annotation("Npgsql:Enum:tipo_recompensa", "monto,porcentaje,traslado")
                .Annotation("Npgsql:Enum:tipo_regla_precio", "descuento,fijo,formula")
                .Annotation("Npgsql:Enum:tipo_usuario", "interno,portal")
                .OldAnnotation("Npgsql:Enum:aplicar_regla", "categoria,producto,todos")
                .OldAnnotation("Npgsql:Enum:estado_cobro", "credito,facturado,finalizado,pagado,por_cobrar,por_facturar")
                .OldAnnotation("Npgsql:Enum:estado_correo", "enviado,fallido,pendiente")
                .OldAnnotation("Npgsql:Enum:estado_cotizacion", "borrador,cancelada,enviada,pedido,recibida")
                .OldAnnotation("Npgsql:Enum:estado_equipo", "disponible,fuera_de_servicio,mantenimiento")
                .OldAnnotation("Npgsql:Enum:estado_mantenimiento", "cancelado,en_proceso,programado,terminado")
                .OldAnnotation("Npgsql:Enum:estado_pedido", "cancelado,en_obra,en_planta,en_ruta,entregado,programado")
                .OldAnnotation("Npgsql:Enum:estado_viaje", "cargando,en_obra,en_ruta,programado,regresando,terminado")
                .OldAnnotation("Npgsql:Enum:estatus_planta", "actualizacion,confirmado,enviado,no_enviado,rechazada")
                .OldAnnotation("Npgsql:Enum:etapa_prospecto", "calificado,contactado,ganado,nuevo,perdido,propuesta")
                .OldAnnotation("Npgsql:Enum:metodo_pago", "cheque,efectivo,sin_metodo,tarjeta,transferencia")
                .OldAnnotation("Npgsql:Enum:origen_cotizacion", "erp,portal")
                .OldAnnotation("Npgsql:Enum:seguridad_smtp", "ninguna,ssl,start_tls")
                .OldAnnotation("Npgsql:Enum:tipo_actividad", "correo,documento,llamada,pendiente,reunion")
                .OldAnnotation("Npgsql:Enum:tipo_dato_cambio", "booleano,dinero,fecha,fecha_hora,numero,opcion,referencia,texto")
                .OldAnnotation("Npgsql:Enum:tipo_documento_equipo", "otro,permiso_sct,seguro,tarjeta_circulacion,tenencia,verificacion")
                .OldAnnotation("Npgsql:Enum:tipo_equipo", "allanadora,aplanadora,bomba_estacionaria,bomba_pluma,camioneta,cargador,excavadora,grua,montacargas,otro,pipa,plataforma,retroexcavadora,revolvedor,tractocamion,vibrador,volteo")
                .OldAnnotation("Npgsql:Enum:tipo_evento", "actividad,cambio,creado,eliminado,mensaje,nota,restaurado,sistema")
                .OldAnnotation("Npgsql:Enum:tipo_impuesto", "retencion,traslado")
                .OldAnnotation("Npgsql:Enum:tipo_mantenimiento", "correctivo,preventivo")
                .OldAnnotation("Npgsql:Enum:tipo_movimiento_inventario", "ajuste,entrada,salida")
                .OldAnnotation("Npgsql:Enum:tipo_producto", "concreto,general,servicio")
                .OldAnnotation("Npgsql:Enum:tipo_programa", "codigo,compra_x,cupones,lealtad,promocion,proxima_orden,sellos")
                .OldAnnotation("Npgsql:Enum:tipo_recompensa", "monto,porcentaje,traslado")
                .OldAnnotation("Npgsql:Enum:tipo_regla_precio", "descuento,fijo,formula")
                .OldAnnotation("Npgsql:Enum:tipo_usuario", "interno,portal");

            migrationBuilder.AddForeignKey(
                name: "FK_Remision_Usuario_OperadorId",
                table: "Remision",
                column: "OperadorId",
                principalTable: "Usuario",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
