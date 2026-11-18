using EPICO.Domain.Common;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EPICO.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FlotaViajesYPedidoMinimo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "CapacidadM3",
                table: "Equipo",
                newName: "Capacidad");

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
                .OldAnnotation("Npgsql:Enum:estado_pedido", "cancelado,en_obra,en_planta,en_ruta,entregado,programado")
                .OldAnnotation("Npgsql:Enum:estado_viaje", "cargando,en_obra,en_ruta,regresando,terminado")
                .OldAnnotation("Npgsql:Enum:estatus_planta", "actualizacion,confirmado,enviado,no_enviado,rechazada")
                .OldAnnotation("Npgsql:Enum:etapa_prospecto", "calificado,contactado,ganado,nuevo,perdido,propuesta")
                .OldAnnotation("Npgsql:Enum:metodo_pago", "sin_metodo,transferencia")
                .OldAnnotation("Npgsql:Enum:origen_cotizacion", "erp,portal")
                .OldAnnotation("Npgsql:Enum:seguridad_smtp", "ninguna,ssl,start_tls")
                .OldAnnotation("Npgsql:Enum:tipo_actividad", "correo,documento,llamada,pendiente,reunion")
                .OldAnnotation("Npgsql:Enum:tipo_dato_cambio", "booleano,dinero,fecha,fecha_hora,numero,opcion,referencia,texto")
                .OldAnnotation("Npgsql:Enum:tipo_equipo", "allanadora,aplanadora,bomba_estacionaria,bomba_pluma,otro,revolvedor,vibrador")
                .OldAnnotation("Npgsql:Enum:tipo_evento", "actividad,cambio,creado,eliminado,mensaje,nota,restaurado,sistema")
                .OldAnnotation("Npgsql:Enum:tipo_impuesto", "retencion,traslado")
                .OldAnnotation("Npgsql:Enum:tipo_movimiento_inventario", "ajuste,entrada,salida")
                .OldAnnotation("Npgsql:Enum:tipo_producto", "concreto,general,servicio")
                .OldAnnotation("Npgsql:Enum:tipo_programa", "codigo,compra_x,cupones,lealtad,promocion,proxima_orden,sellos")
                .OldAnnotation("Npgsql:Enum:tipo_recompensa", "monto,porcentaje,traslado")
                .OldAnnotation("Npgsql:Enum:tipo_regla_precio", "descuento,fijo,formula")
                .OldAnnotation("Npgsql:Enum:tipo_usuario", "interno,portal");

            migrationBuilder.AddColumn<decimal>(
                name: "PedidoMinimo",
                table: "Producto",
                type: "numeric(14,2)",
                precision: 14,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "Anio",
                table: "Equipo",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<EstadoEquipo>(
                name: "Estado",
                table: "Equipo",
                type: "estado_equipo",
                nullable: false,
                defaultValue: EstadoEquipo.Disponible);

            migrationBuilder.AddColumn<string>(
                name: "GpsId",
                table: "Equipo",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Marca",
                table: "Equipo",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Modelo",
                table: "Equipo",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Notas",
                table: "Equipo",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OperadorNombre",
                table: "Equipo",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UnidadCapacidad",
                table: "Equipo",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            // La capacidad de antes era en m³.
            migrationBuilder.Sql("UPDATE \"Equipo\" SET \"UnidadCapacidad\" = 'm³' WHERE \"Capacidad\" IS NOT NULL;");

            migrationBuilder.CreateIndex(
                name: "IX_Equipo_GpsId",
                table: "Equipo",
                column: "GpsId",
                unique: true,
                filter: "\"GpsId\" IS NOT NULL AND NOT \"IsDeleted\"");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Equipo_GpsId",
                table: "Equipo");

            migrationBuilder.DropColumn(
                name: "PedidoMinimo",
                table: "Producto");

            migrationBuilder.DropColumn(
                name: "Anio",
                table: "Equipo");

            migrationBuilder.DropColumn(
                name: "Estado",
                table: "Equipo");

            migrationBuilder.DropColumn(
                name: "GpsId",
                table: "Equipo");

            migrationBuilder.DropColumn(
                name: "Marca",
                table: "Equipo");

            migrationBuilder.DropColumn(
                name: "Modelo",
                table: "Equipo");

            migrationBuilder.DropColumn(
                name: "Notas",
                table: "Equipo");

            migrationBuilder.DropColumn(
                name: "OperadorNombre",
                table: "Equipo");

            migrationBuilder.DropColumn(
                name: "UnidadCapacidad",
                table: "Equipo");

            migrationBuilder.RenameColumn(
                name: "Capacidad",
                table: "Equipo",
                newName: "CapacidadM3");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:aplicar_regla", "categoria,producto,todos")
                .Annotation("Npgsql:Enum:estado_cobro", "credito,facturado,finalizado,pagado,por_cobrar,por_facturar")
                .Annotation("Npgsql:Enum:estado_correo", "enviado,fallido,pendiente")
                .Annotation("Npgsql:Enum:estado_cotizacion", "borrador,cancelada,enviada,pedido,recibida")
                .Annotation("Npgsql:Enum:estado_pedido", "cancelado,en_obra,en_planta,en_ruta,entregado,programado")
                .Annotation("Npgsql:Enum:estado_viaje", "cargando,en_obra,en_ruta,regresando,terminado")
                .Annotation("Npgsql:Enum:estatus_planta", "actualizacion,confirmado,enviado,no_enviado,rechazada")
                .Annotation("Npgsql:Enum:etapa_prospecto", "calificado,contactado,ganado,nuevo,perdido,propuesta")
                .Annotation("Npgsql:Enum:metodo_pago", "sin_metodo,transferencia")
                .Annotation("Npgsql:Enum:origen_cotizacion", "erp,portal")
                .Annotation("Npgsql:Enum:seguridad_smtp", "ninguna,ssl,start_tls")
                .Annotation("Npgsql:Enum:tipo_actividad", "correo,documento,llamada,pendiente,reunion")
                .Annotation("Npgsql:Enum:tipo_dato_cambio", "booleano,dinero,fecha,fecha_hora,numero,opcion,referencia,texto")
                .Annotation("Npgsql:Enum:tipo_equipo", "allanadora,aplanadora,bomba_estacionaria,bomba_pluma,otro,revolvedor,vibrador")
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
        }
    }
}
