using System;
using System.Collections.Generic;
using EPICO.Domain.Common;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EPICO.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PlantasYTrayectos : Migration
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
                .OldAnnotation("Npgsql:Enum:tipo_usuario", "interno,portal");

            migrationBuilder.AddColumn<List<Guid>>(
                name: "SucursalIds",
                table: "Equipo",
                type: "uuid[]",
                nullable: false,
                defaultValueSql: "'{}'");

            // Cada equipo opera en su planta principal.
            migrationBuilder.Sql("UPDATE \"Equipo\" SET \"SucursalIds\" = ARRAY[\"SucursalId\"];");

            migrationBuilder.CreateTable(
                name: "Trayecto",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EquipoId = table.Column<Guid>(type: "uuid", nullable: false),
                    SucursalId = table.Column<Guid>(type: "uuid", nullable: true),
                    Inicio = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Fin = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Tipo = table.Column<TipoTrayecto>(type: "tipo_trayecto", nullable: false),
                    Origen = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Destino = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    OdometroInicio = table.Column<decimal>(type: "numeric(12,1)", precision: 12, scale: 1, nullable: true),
                    OdometroFin = table.Column<decimal>(type: "numeric(12,1)", precision: 12, scale: 1, nullable: true),
                    Km = table.Column<decimal>(type: "numeric(10,1)", precision: 10, scale: 1, nullable: true),
                    KmEstimado = table.Column<bool>(type: "boolean", nullable: false),
                    PedidoId = table.Column<Guid>(type: "uuid", nullable: true),
                    RemisionId = table.Column<Guid>(type: "uuid", nullable: true),
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
                    table.PrimaryKey("PK_Trayecto", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Trayecto_Equipo_EquipoId",
                        column: x => x.EquipoId,
                        principalTable: "Equipo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Trayecto_Operador_OperadorId",
                        column: x => x.OperadorId,
                        principalTable: "Operador",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Trayecto_Pedido_PedidoId",
                        column: x => x.PedidoId,
                        principalTable: "Pedido",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Trayecto_Remision_RemisionId",
                        column: x => x.RemisionId,
                        principalTable: "Remision",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Trayecto_Sucursal_SucursalId",
                        column: x => x.SucursalId,
                        principalTable: "Sucursal",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Trayecto_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Trayecto_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Equipo_SucursalIds",
                table: "Equipo",
                column: "SucursalIds")
                .Annotation("Npgsql:IndexMethod", "gin");

            migrationBuilder.CreateIndex(
                name: "IX_Trayecto_CreatedById",
                table: "Trayecto",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Trayecto_EquipoId_Inicio",
                table: "Trayecto",
                columns: new[] { "EquipoId", "Inicio" });

            migrationBuilder.CreateIndex(
                name: "IX_Trayecto_OperadorId",
                table: "Trayecto",
                column: "OperadorId");

            migrationBuilder.CreateIndex(
                name: "IX_Trayecto_PedidoId",
                table: "Trayecto",
                column: "PedidoId");

            migrationBuilder.CreateIndex(
                name: "IX_Trayecto_RemisionId",
                table: "Trayecto",
                column: "RemisionId",
                unique: true,
                filter: "\"RemisionId\" IS NOT NULL AND NOT \"IsDeleted\"");

            migrationBuilder.CreateIndex(
                name: "IX_Trayecto_SucursalId",
                table: "Trayecto",
                column: "SucursalId");

            migrationBuilder.CreateIndex(
                name: "IX_Trayecto_UpdatedById",
                table: "Trayecto",
                column: "UpdatedById");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Trayecto");

            migrationBuilder.DropIndex(
                name: "IX_Equipo_SucursalIds",
                table: "Equipo");

            migrationBuilder.DropColumn(
                name: "SucursalIds",
                table: "Equipo");

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
        }
    }
}
