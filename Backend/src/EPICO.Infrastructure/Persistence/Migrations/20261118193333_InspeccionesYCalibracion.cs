using System;
using System.Collections.Generic;
using EPICO.Domain.Common;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EPICO.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InspeccionesYCalibracion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:aplicar_regla", "categoria,producto,todos")
                .Annotation("Npgsql:Enum:estado_cobro", "credito,facturado,finalizado,pagado,por_cobrar,por_facturar")
                .Annotation("Npgsql:Enum:estado_correo", "enviado,fallido,pendiente")
                .Annotation("Npgsql:Enum:estado_cotizacion", "borrador,cancelada,enviada,pedido,recibida")
                .Annotation("Npgsql:Enum:estado_equipo", "disponible,fuera_de_servicio,mantenimiento")
                .Annotation("Npgsql:Enum:estado_mantenimiento", "cancelado,en_proceso,programado,terminado")
                .Annotation("Npgsql:Enum:estado_pedido", "cancelado,en_obra,en_planta,en_ruta,entregado,programado")
                .Annotation("Npgsql:Enum:estado_solicitud", "aceptada,pendiente,rechazada")
                .Annotation("Npgsql:Enum:estado_viaje", "cargando,en_obra,en_ruta,programado,regresando,terminado")
                .Annotation("Npgsql:Enum:estatus_planta", "actualizacion,confirmado,enviado,no_enviado,rechazada")
                .Annotation("Npgsql:Enum:etapa_prospecto", "calificado,contactado,ganado,nuevo,perdido,propuesta")
                .Annotation("Npgsql:Enum:fuente_posicion", "demo,manual,traccar")
                .Annotation("Npgsql:Enum:metodo_pago", "cheque,efectivo,sin_metodo,tarjeta,transferencia")
                .Annotation("Npgsql:Enum:origen_cotizacion", "erp,portal")
                .Annotation("Npgsql:Enum:origen_reagenda", "cliente,logistica,planta,ventas")
                .Annotation("Npgsql:Enum:resultado_inspeccion", "aprobada,con_observaciones,rechazada")
                .Annotation("Npgsql:Enum:seguridad_smtp", "ninguna,ssl,start_tls")
                .Annotation("Npgsql:Enum:tipo_actividad", "correo,documento,llamada,pendiente,reunion")
                .Annotation("Npgsql:Enum:tipo_dato_cambio", "booleano,dinero,fecha,fecha_hora,numero,opcion,referencia,texto")
                .Annotation("Npgsql:Enum:tipo_documento_equipo", "calibracion,otro,permiso_sct,seguro,tarjeta_circulacion,tenencia,verificacion")
                .Annotation("Npgsql:Enum:tipo_equipo", "allanadora,aplanadora,bomba_estacionaria,bomba_pluma,camioneta,cargador,excavadora,grua,montacargas,otro,pipa,plataforma,retroexcavadora,revolvedor,tractocamion,vibrador,volteo")
                .Annotation("Npgsql:Enum:tipo_evento", "actividad,cambio,creado,eliminado,mensaje,nota,restaurado,sistema")
                .Annotation("Npgsql:Enum:tipo_impuesto", "retencion,traslado")
                .Annotation("Npgsql:Enum:tipo_mantenimiento", "correctivo,preventivo")
                .Annotation("Npgsql:Enum:tipo_movimiento_inventario", "ajuste,entrada,salida")
                .Annotation("Npgsql:Enum:tipo_producto", "concreto,general,servicio")
                .Annotation("Npgsql:Enum:tipo_programa", "codigo,compra_x,cupones,lealtad,promocion,proxima_orden,sellos")
                .Annotation("Npgsql:Enum:tipo_recompensa", "monto,porcentaje,traslado")
                .Annotation("Npgsql:Enum:tipo_regla_precio", "descuento,fijo,formula")
                .Annotation("Npgsql:Enum:tipo_trayecto", "entrega,flete,mantenimiento,otro,traslado")
                .Annotation("Npgsql:Enum:tipo_usuario", "interno,portal")
                .OldAnnotation("Npgsql:Enum:aplicar_regla", "categoria,producto,todos")
                .OldAnnotation("Npgsql:Enum:estado_cobro", "credito,facturado,finalizado,pagado,por_cobrar,por_facturar")
                .OldAnnotation("Npgsql:Enum:estado_correo", "enviado,fallido,pendiente")
                .OldAnnotation("Npgsql:Enum:estado_cotizacion", "borrador,cancelada,enviada,pedido,recibida")
                .OldAnnotation("Npgsql:Enum:estado_equipo", "disponible,fuera_de_servicio,mantenimiento")
                .OldAnnotation("Npgsql:Enum:estado_mantenimiento", "cancelado,en_proceso,programado,terminado")
                .OldAnnotation("Npgsql:Enum:estado_pedido", "cancelado,en_obra,en_planta,en_ruta,entregado,programado")
                .OldAnnotation("Npgsql:Enum:estado_solicitud", "aceptada,pendiente,rechazada")
                .OldAnnotation("Npgsql:Enum:estado_viaje", "cargando,en_obra,en_ruta,programado,regresando,terminado")
                .OldAnnotation("Npgsql:Enum:estatus_planta", "actualizacion,confirmado,enviado,no_enviado,rechazada")
                .OldAnnotation("Npgsql:Enum:etapa_prospecto", "calificado,contactado,ganado,nuevo,perdido,propuesta")
                .OldAnnotation("Npgsql:Enum:fuente_posicion", "demo,manual,traccar")
                .OldAnnotation("Npgsql:Enum:metodo_pago", "cheque,efectivo,sin_metodo,tarjeta,transferencia")
                .OldAnnotation("Npgsql:Enum:origen_cotizacion", "erp,portal")
                .OldAnnotation("Npgsql:Enum:origen_reagenda", "cliente,logistica,planta,ventas")
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
                .OldAnnotation("Npgsql:Enum:tipo_trayecto", "entrega,flete,mantenimiento,otro,traslado")
                .OldAnnotation("Npgsql:Enum:tipo_usuario", "interno,portal");

            migrationBuilder.CreateTable(
                name: "InspeccionEquipo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EquipoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Fecha = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    OperadorId = table.Column<Guid>(type: "uuid", nullable: true),
                    InspectorNombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Resultado = table.Column<ResultadoInspeccion>(type: "resultado_inspeccion", nullable: false),
                    Puntos = table.Column<string>(type: "jsonb", nullable: false),
                    OdometroKm = table.Column<decimal>(type: "numeric(12,1)", precision: 12, scale: 1, nullable: true),
                    FirmaArchivoId = table.Column<Guid>(type: "uuid", nullable: true),
                    FotoArchivoIds = table.Column<List<Guid>>(type: "uuid[]", nullable: false),
                    Notas = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InspeccionEquipo", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InspeccionEquipo_Archivo_FirmaArchivoId",
                        column: x => x.FirmaArchivoId,
                        principalTable: "Archivo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InspeccionEquipo_Equipo_EquipoId",
                        column: x => x.EquipoId,
                        principalTable: "Equipo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InspeccionEquipo_Operador_OperadorId",
                        column: x => x.OperadorId,
                        principalTable: "Operador",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InspeccionEquipo_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InspeccionEquipo_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_InspeccionEquipo_CreatedById",
                table: "InspeccionEquipo",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_InspeccionEquipo_EquipoId_Fecha",
                table: "InspeccionEquipo",
                columns: new[] { "EquipoId", "Fecha" });

            migrationBuilder.CreateIndex(
                name: "IX_InspeccionEquipo_FirmaArchivoId",
                table: "InspeccionEquipo",
                column: "FirmaArchivoId");

            migrationBuilder.CreateIndex(
                name: "IX_InspeccionEquipo_OperadorId",
                table: "InspeccionEquipo",
                column: "OperadorId");

            migrationBuilder.CreateIndex(
                name: "IX_InspeccionEquipo_UpdatedById",
                table: "InspeccionEquipo",
                column: "UpdatedById");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "InspeccionEquipo");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:aplicar_regla", "categoria,producto,todos")
                .Annotation("Npgsql:Enum:estado_cobro", "credito,facturado,finalizado,pagado,por_cobrar,por_facturar")
                .Annotation("Npgsql:Enum:estado_correo", "enviado,fallido,pendiente")
                .Annotation("Npgsql:Enum:estado_cotizacion", "borrador,cancelada,enviada,pedido,recibida")
                .Annotation("Npgsql:Enum:estado_equipo", "disponible,fuera_de_servicio,mantenimiento")
                .Annotation("Npgsql:Enum:estado_mantenimiento", "cancelado,en_proceso,programado,terminado")
                .Annotation("Npgsql:Enum:estado_pedido", "cancelado,en_obra,en_planta,en_ruta,entregado,programado")
                .Annotation("Npgsql:Enum:estado_solicitud", "aceptada,pendiente,rechazada")
                .Annotation("Npgsql:Enum:estado_viaje", "cargando,en_obra,en_ruta,programado,regresando,terminado")
                .Annotation("Npgsql:Enum:estatus_planta", "actualizacion,confirmado,enviado,no_enviado,rechazada")
                .Annotation("Npgsql:Enum:etapa_prospecto", "calificado,contactado,ganado,nuevo,perdido,propuesta")
                .Annotation("Npgsql:Enum:fuente_posicion", "demo,manual,traccar")
                .Annotation("Npgsql:Enum:metodo_pago", "cheque,efectivo,sin_metodo,tarjeta,transferencia")
                .Annotation("Npgsql:Enum:origen_cotizacion", "erp,portal")
                .Annotation("Npgsql:Enum:origen_reagenda", "cliente,logistica,planta,ventas")
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
                .Annotation("Npgsql:Enum:tipo_trayecto", "entrega,flete,mantenimiento,otro,traslado")
                .Annotation("Npgsql:Enum:tipo_usuario", "interno,portal")
                .OldAnnotation("Npgsql:Enum:aplicar_regla", "categoria,producto,todos")
                .OldAnnotation("Npgsql:Enum:estado_cobro", "credito,facturado,finalizado,pagado,por_cobrar,por_facturar")
                .OldAnnotation("Npgsql:Enum:estado_correo", "enviado,fallido,pendiente")
                .OldAnnotation("Npgsql:Enum:estado_cotizacion", "borrador,cancelada,enviada,pedido,recibida")
                .OldAnnotation("Npgsql:Enum:estado_equipo", "disponible,fuera_de_servicio,mantenimiento")
                .OldAnnotation("Npgsql:Enum:estado_mantenimiento", "cancelado,en_proceso,programado,terminado")
                .OldAnnotation("Npgsql:Enum:estado_pedido", "cancelado,en_obra,en_planta,en_ruta,entregado,programado")
                .OldAnnotation("Npgsql:Enum:estado_solicitud", "aceptada,pendiente,rechazada")
                .OldAnnotation("Npgsql:Enum:estado_viaje", "cargando,en_obra,en_ruta,programado,regresando,terminado")
                .OldAnnotation("Npgsql:Enum:estatus_planta", "actualizacion,confirmado,enviado,no_enviado,rechazada")
                .OldAnnotation("Npgsql:Enum:etapa_prospecto", "calificado,contactado,ganado,nuevo,perdido,propuesta")
                .OldAnnotation("Npgsql:Enum:fuente_posicion", "demo,manual,traccar")
                .OldAnnotation("Npgsql:Enum:metodo_pago", "cheque,efectivo,sin_metodo,tarjeta,transferencia")
                .OldAnnotation("Npgsql:Enum:origen_cotizacion", "erp,portal")
                .OldAnnotation("Npgsql:Enum:origen_reagenda", "cliente,logistica,planta,ventas")
                .OldAnnotation("Npgsql:Enum:resultado_inspeccion", "aprobada,con_observaciones,rechazada")
                .OldAnnotation("Npgsql:Enum:seguridad_smtp", "ninguna,ssl,start_tls")
                .OldAnnotation("Npgsql:Enum:tipo_actividad", "correo,documento,llamada,pendiente,reunion")
                .OldAnnotation("Npgsql:Enum:tipo_dato_cambio", "booleano,dinero,fecha,fecha_hora,numero,opcion,referencia,texto")
                .OldAnnotation("Npgsql:Enum:tipo_documento_equipo", "calibracion,otro,permiso_sct,seguro,tarjeta_circulacion,tenencia,verificacion")
                .OldAnnotation("Npgsql:Enum:tipo_equipo", "allanadora,aplanadora,bomba_estacionaria,bomba_pluma,camioneta,cargador,excavadora,grua,montacargas,otro,pipa,plataforma,retroexcavadora,revolvedor,tractocamion,vibrador,volteo")
                .OldAnnotation("Npgsql:Enum:tipo_evento", "actividad,cambio,creado,eliminado,mensaje,nota,restaurado,sistema")
                .OldAnnotation("Npgsql:Enum:tipo_impuesto", "retencion,traslado")
                .OldAnnotation("Npgsql:Enum:tipo_mantenimiento", "correctivo,preventivo")
                .OldAnnotation("Npgsql:Enum:tipo_movimiento_inventario", "ajuste,entrada,salida")
                .OldAnnotation("Npgsql:Enum:tipo_producto", "concreto,general,servicio")
                .OldAnnotation("Npgsql:Enum:tipo_programa", "codigo,compra_x,cupones,lealtad,promocion,proxima_orden,sellos")
                .OldAnnotation("Npgsql:Enum:tipo_recompensa", "monto,porcentaje,traslado")
                .OldAnnotation("Npgsql:Enum:tipo_regla_precio", "descuento,fijo,formula")
                .OldAnnotation("Npgsql:Enum:tipo_trayecto", "entrega,flete,mantenimiento,otro,traslado")
                .OldAnnotation("Npgsql:Enum:tipo_usuario", "interno,portal");
        }
    }
}
