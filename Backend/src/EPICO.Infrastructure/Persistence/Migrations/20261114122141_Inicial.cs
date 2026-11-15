using System;
using System.Collections.Generic;
using System.Net;
using System.Text.Json;
using EPICO.Domain.Common;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EPICO.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Inicial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:aplicar_regla", "categoria,producto,todos")
                .Annotation("Npgsql:Enum:estado_cobro", "credito,facturado,finalizado,pagado,por_cobrar,por_facturar")
                .Annotation("Npgsql:Enum:estado_cotizacion", "borrador,cancelada,enviada,pedido,recibida")
                .Annotation("Npgsql:Enum:estado_pedido", "cancelado,en_obra,en_planta,en_ruta,entregado,programado")
                .Annotation("Npgsql:Enum:estado_viaje", "cargando,en_obra,en_ruta,regresando,terminado")
                .Annotation("Npgsql:Enum:estatus_planta", "actualizacion,confirmado,enviado,no_enviado,rechazada")
                .Annotation("Npgsql:Enum:etapa_prospecto", "calificado,contactado,ganado,nuevo,perdido,propuesta")
                .Annotation("Npgsql:Enum:metodo_pago", "sin_metodo,transferencia")
                .Annotation("Npgsql:Enum:origen_cotizacion", "erp,portal")
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
                .Annotation("Npgsql:Enum:tipo_usuario", "interno,portal");

            migrationBuilder.CreateTable(
                name: "Moneda",
                columns: table => new
                {
                    Codigo = table.Column<string>(type: "character(3)", fixedLength: true, maxLength: 3, nullable: false),
                    Nombre = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Decimales = table.Column<short>(type: "smallint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Moneda", x => x.Codigo);
                });

            migrationBuilder.CreateTable(
                name: "UnidadMedida",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Clave = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Nombre = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ClaveSat = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UnidadMedida", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Actividad",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganizacionId = table.Column<Guid>(type: "uuid", nullable: false),
                    RegistroTipo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    RegistroId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tipo = table.Column<TipoActividad>(type: "tipo_actividad", nullable: false),
                    Resumen = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    FechaLimite = table.Column<DateOnly>(type: "date", nullable: false),
                    AsignadaAId = table.Column<Guid>(type: "uuid", nullable: false),
                    Nota = table.Column<string>(type: "text", nullable: true),
                    HechaEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CanceladaEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Actividad", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Archivo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganizacionId = table.Column<Guid>(type: "uuid", nullable: true),
                    Nombre = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    TipoMime = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TamanoBytes = table.Column<long>(type: "bigint", nullable: false),
                    Ruta = table.Column<string>(type: "text", nullable: false),
                    Sha256 = table.Column<string>(type: "character(64)", fixedLength: true, maxLength: 64, nullable: true),
                    Categoria = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    RegistroTipo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    RegistroId = table.Column<Guid>(type: "uuid", nullable: true),
                    SubidoPorId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Archivo", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Usuario",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Correo = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    Tipo = table.Column<TipoUsuario>(type: "tipo_usuario", nullable: false),
                    Nombre = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Apellidos = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Telefono = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Puesto = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    FotoArchivoId = table.Column<Guid>(type: "uuid", nullable: true),
                    Activo = table.Column<bool>(type: "boolean", nullable: false),
                    CorreoVerificado = table.Column<bool>(type: "boolean", nullable: false),
                    IntentosFallidos = table.Column<int>(type: "integer", nullable: false),
                    BloqueadoHasta = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UltimoAcceso = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Usuario", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Usuario_Archivo_FotoArchivoId",
                        column: x => x.FotoArchivoId,
                        principalTable: "Archivo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Usuario_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Usuario_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Organizacion",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Nombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Slug = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    LogoArchivoId = table.Column<Guid>(type: "uuid", nullable: true),
                    Activa = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Organizacion", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Organizacion_Archivo_LogoArchivoId",
                        column: x => x.LogoArchivoId,
                        principalTable: "Archivo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Organizacion_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Organizacion_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Seguidor",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RegistroTipo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    RegistroId = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tipos = table.Column<List<TipoEvento>>(type: "tipo_evento[]", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Seguidor", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Seguidor_Usuario_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CategoriaProducto",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganizacionId = table.Column<Guid>(type: "uuid", nullable: true),
                    Clave = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Nombre = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Tipo = table.Column<TipoProducto>(type: "tipo_producto", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CategoriaProducto", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CategoriaProducto_Organizacion_OrganizacionId",
                        column: x => x.OrganizacionId,
                        principalTable: "Organizacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CategoriaProducto_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CategoriaProducto_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Empresa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganizacionId = table.Column<Guid>(type: "uuid", nullable: false),
                    RazonSocial = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    NombreComercial = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    RFC = table.Column<string>(type: "character varying(13)", maxLength: 13, nullable: true),
                    RegimenFiscal = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: true),
                    CPFiscal = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: true),
                    DomicilioFiscal = table.Column<string>(type: "text", nullable: true),
                    ZonaHoraria = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    MonedaCodigo = table.Column<string>(type: "character(3)", fixedLength: true, maxLength: 3, nullable: false),
                    LogoArchivoId = table.Column<Guid>(type: "uuid", nullable: true),
                    CsdCerArchivoId = table.Column<Guid>(type: "uuid", nullable: true),
                    CsdKeyArchivoId = table.Column<Guid>(type: "uuid", nullable: true),
                    CsdPasswordCifrada = table.Column<string>(type: "text", nullable: true),
                    CsdVence = table.Column<DateOnly>(type: "date", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Empresa", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Empresa_Archivo_CsdCerArchivoId",
                        column: x => x.CsdCerArchivoId,
                        principalTable: "Archivo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Empresa_Archivo_CsdKeyArchivoId",
                        column: x => x.CsdKeyArchivoId,
                        principalTable: "Archivo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Empresa_Archivo_LogoArchivoId",
                        column: x => x.LogoArchivoId,
                        principalTable: "Archivo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Empresa_Moneda_MonedaCodigo",
                        column: x => x.MonedaCodigo,
                        principalTable: "Moneda",
                        principalColumn: "Codigo",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Empresa_Organizacion_OrganizacionId",
                        column: x => x.OrganizacionId,
                        principalTable: "Organizacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Empresa_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Empresa_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Rol",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganizacionId = table.Column<Guid>(type: "uuid", nullable: true),
                    Nombre = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Descripcion = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Rol", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Rol_Organizacion_OrganizacionId",
                        column: x => x.OrganizacionId,
                        principalTable: "Organizacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Rol_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Rol_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Impuesto",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmpresaId = table.Column<Guid>(type: "uuid", nullable: true),
                    Nombre = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Tipo = table.Column<TipoImpuesto>(type: "tipo_impuesto", nullable: false),
                    ImpuestoSat = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    TipoFactor = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Tasa = table.Column<decimal>(type: "numeric(8,6)", precision: 8, scale: 6, nullable: false),
                    CuentaContableId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Impuesto", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Impuesto_Empresa_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Impuesto_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Impuesto_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ListaPrecios",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganizacionId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmpresaRestringidaId = table.Column<Guid>(type: "uuid", nullable: true),
                    Nombre = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    MonedaCodigo = table.Column<string>(type: "character(3)", fixedLength: true, maxLength: 3, nullable: false),
                    Activa = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ListaPrecios", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ListaPrecios_Empresa_EmpresaRestringidaId",
                        column: x => x.EmpresaRestringidaId,
                        principalTable: "Empresa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ListaPrecios_Moneda_MonedaCodigo",
                        column: x => x.MonedaCodigo,
                        principalTable: "Moneda",
                        principalColumn: "Codigo",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ListaPrecios_Organizacion_OrganizacionId",
                        column: x => x.OrganizacionId,
                        principalTable: "Organizacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ListaPrecios_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ListaPrecios_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Producto",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganizacionId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmpresaRestringidaId = table.Column<Guid>(type: "uuid", nullable: true),
                    CategoriaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tipo = table.Column<TipoProducto>(type: "tipo_producto", nullable: false),
                    Codigo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Nombre = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Descripcion = table.Column<string>(type: "text", nullable: false),
                    UnidadId = table.Column<Guid>(type: "uuid", nullable: false),
                    PrecioLista = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    MonedaCodigo = table.Column<string>(type: "character(3)", fixedLength: true, maxLength: 3, nullable: false),
                    MinimoCobro = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    ClaveProdServSat = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: true),
                    ControlaExistencias = table.Column<bool>(type: "boolean", nullable: false),
                    MinimoExistencias = table.Column<decimal>(type: "numeric(14,3)", precision: 14, scale: 3, nullable: true),
                    ConcretoFc = table.Column<string>(type: "character varying(6)", maxLength: 6, nullable: true),
                    ConcretoEdadDias = table.Column<short>(type: "smallint", nullable: true),
                    ConcretoRevenimientoCm = table.Column<short>(type: "smallint", nullable: true),
                    ConcretoSuministro = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: true),
                    EquipoTipo = table.Column<TipoEquipo>(type: "tipo_equipo", nullable: true),
                    Activo = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Producto", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Producto_CategoriaProducto_CategoriaId",
                        column: x => x.CategoriaId,
                        principalTable: "CategoriaProducto",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Producto_Empresa_EmpresaRestringidaId",
                        column: x => x.EmpresaRestringidaId,
                        principalTable: "Empresa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Producto_Moneda_MonedaCodigo",
                        column: x => x.MonedaCodigo,
                        principalTable: "Moneda",
                        principalColumn: "Codigo",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Producto_Organizacion_OrganizacionId",
                        column: x => x.OrganizacionId,
                        principalTable: "Organizacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Producto_UnidadMedida_UnidadId",
                        column: x => x.UnidadId,
                        principalTable: "UnidadMedida",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Producto_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Producto_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Sesion",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmpresaId = table.Column<Guid>(type: "uuid", nullable: true),
                    RefreshTokenHash = table.Column<string>(type: "text", nullable: false),
                    CreadaEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiraEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RevocadaEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Ip = table.Column<IPAddress>(type: "inet", nullable: true),
                    Agente = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sesion", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Sesion_Empresa_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Sesion_Usuario_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Sucursal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmpresaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Codigo = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Nombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ZonaHoraria = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Direccion = table.Column<string>(type: "text", nullable: true),
                    Lat = table.Column<decimal>(type: "numeric(9,6)", precision: 9, scale: 6, nullable: true),
                    Lng = table.Column<decimal>(type: "numeric(9,6)", precision: 9, scale: 6, nullable: true),
                    Telefono = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Activa = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sucursal", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Sucursal_Empresa_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Sucursal_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Sucursal_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RolPermiso",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RolId = table.Column<Guid>(type: "uuid", nullable: false),
                    Permiso = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RolPermiso", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RolPermiso_Rol_RolId",
                        column: x => x.RolId,
                        principalTable: "Rol",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Cliente",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganizacionId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmpresaRestringidaId = table.Column<Guid>(type: "uuid", nullable: true),
                    Nombre = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Giro = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Correo = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: true),
                    Telefono = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    SitioWeb = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    EsPublicoGeneral = table.Column<bool>(type: "boolean", nullable: false),
                    VendedorId = table.Column<Guid>(type: "uuid", nullable: true),
                    ListaPreciosId = table.Column<Guid>(type: "uuid", nullable: true),
                    DiasCredito = table.Column<int>(type: "integer", nullable: false),
                    LimiteCredito = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    Notas = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Cliente", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Cliente_Empresa_EmpresaRestringidaId",
                        column: x => x.EmpresaRestringidaId,
                        principalTable: "Empresa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Cliente_ListaPrecios_ListaPreciosId",
                        column: x => x.ListaPreciosId,
                        principalTable: "ListaPrecios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Cliente_Organizacion_OrganizacionId",
                        column: x => x.OrganizacionId,
                        principalTable: "Organizacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Cliente_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Cliente_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Cliente_Usuario_VendedorId",
                        column: x => x.VendedorId,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProgramaDescuento",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganizacionId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmpresaRestringidaId = table.Column<Guid>(type: "uuid", nullable: true),
                    Nombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Tipo = table.Column<TipoPrograma>(type: "tipo_programa", nullable: false),
                    Activo = table.Column<bool>(type: "boolean", nullable: false),
                    Inicio = table.Column<DateOnly>(type: "date", nullable: true),
                    Fin = table.Column<DateOnly>(type: "date", nullable: true),
                    ProductoId = table.Column<Guid>(type: "uuid", nullable: true),
                    CategoriaId = table.Column<Guid>(type: "uuid", nullable: true),
                    CompraMinima = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    Codigo = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CantidadX = table.Column<int>(type: "integer", nullable: true),
                    CantidadY = table.Column<int>(type: "integer", nullable: true),
                    Recompensa = table.Column<TipoRecompensa>(type: "tipo_recompensa", nullable: false),
                    Valor = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    PesosPorPunto = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    PuntosCanje = table.Column<int>(type: "integer", nullable: true),
                    Meta = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProgramaDescuento", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProgramaDescuento_CategoriaProducto_CategoriaId",
                        column: x => x.CategoriaId,
                        principalTable: "CategoriaProducto",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProgramaDescuento_Empresa_EmpresaRestringidaId",
                        column: x => x.EmpresaRestringidaId,
                        principalTable: "Empresa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProgramaDescuento_Organizacion_OrganizacionId",
                        column: x => x.OrganizacionId,
                        principalTable: "Organizacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProgramaDescuento_Producto_ProductoId",
                        column: x => x.ProductoId,
                        principalTable: "Producto",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProgramaDescuento_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProgramaDescuento_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ReglaPrecio",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ListaPreciosId = table.Column<Guid>(type: "uuid", nullable: false),
                    AplicarA = table.Column<AplicarRegla>(type: "aplicar_regla", nullable: false),
                    ProductoId = table.Column<Guid>(type: "uuid", nullable: true),
                    CategoriaId = table.Column<Guid>(type: "uuid", nullable: true),
                    Tipo = table.Column<TipoReglaPrecio>(type: "tipo_regla_precio", nullable: false),
                    PrecioFijo = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    DescuentoPct = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    Recargo = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    CantidadMinima = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    Inicio = table.Column<DateOnly>(type: "date", nullable: true),
                    Fin = table.Column<DateOnly>(type: "date", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReglaPrecio", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReglaPrecio_CategoriaProducto_CategoriaId",
                        column: x => x.CategoriaId,
                        principalTable: "CategoriaProducto",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ReglaPrecio_ListaPrecios_ListaPreciosId",
                        column: x => x.ListaPreciosId,
                        principalTable: "ListaPrecios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ReglaPrecio_Producto_ProductoId",
                        column: x => x.ProductoId,
                        principalTable: "Producto",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ReglaPrecio_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ReglaPrecio_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Evento",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganizacionId = table.Column<Guid>(type: "uuid", nullable: false),
                    RegistroTipo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    RegistroId = table.Column<Guid>(type: "uuid", nullable: false),
                    Fecha = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AutorId = table.Column<Guid>(type: "uuid", nullable: true),
                    Tipo = table.Column<TipoEvento>(type: "tipo_evento", nullable: false),
                    Texto = table.Column<string>(type: "text", nullable: false),
                    Detalles = table.Column<string>(type: "jsonb", nullable: true),
                    SesionId = table.Column<Guid>(type: "uuid", nullable: true),
                    RegistroPadreTipo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    RegistroPadreId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Evento", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Evento_Organizacion_OrganizacionId",
                        column: x => x.OrganizacionId,
                        principalTable: "Organizacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Evento_Sesion_SesionId",
                        column: x => x.SesionId,
                        principalTable: "Sesion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Evento_Usuario_AutorId",
                        column: x => x.AutorId,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Equipo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SucursalId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tipo = table.Column<TipoEquipo>(type: "tipo_equipo", nullable: false),
                    NumeroEconomico = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Descripcion = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Placas = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: true),
                    CapacidadM3 = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    Activo = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Equipo", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Equipo_Sucursal_SucursalId",
                        column: x => x.SucursalId,
                        principalTable: "Sucursal",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Equipo_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Equipo_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Existencia",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductoId = table.Column<Guid>(type: "uuid", nullable: false),
                    SucursalId = table.Column<Guid>(type: "uuid", nullable: false),
                    Cantidad = table.Column<decimal>(type: "numeric(14,3)", precision: 14, scale: 3, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Existencia", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Existencia_Producto_ProductoId",
                        column: x => x.ProductoId,
                        principalTable: "Producto",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Existencia_Sucursal_SucursalId",
                        column: x => x.SucursalId,
                        principalTable: "Sucursal",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ListaPreciosSucursal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ListaPreciosId = table.Column<Guid>(type: "uuid", nullable: false),
                    SucursalId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ListaPreciosSucursal", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ListaPreciosSucursal_ListaPrecios_ListaPreciosId",
                        column: x => x.ListaPreciosId,
                        principalTable: "ListaPrecios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ListaPreciosSucursal_Sucursal_SucursalId",
                        column: x => x.SucursalId,
                        principalTable: "Sucursal",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MovimientoInventario",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductoId = table.Column<Guid>(type: "uuid", nullable: false),
                    SucursalId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tipo = table.Column<TipoMovimientoInventario>(type: "tipo_movimiento_inventario", nullable: false),
                    Cantidad = table.Column<decimal>(type: "numeric(14,3)", precision: 14, scale: 3, nullable: false),
                    Nota = table.Column<string>(type: "text", nullable: true),
                    Fecha = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: true),
                    RegistroTipo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    RegistroId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MovimientoInventario", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MovimientoInventario_Producto_ProductoId",
                        column: x => x.ProductoId,
                        principalTable: "Producto",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MovimientoInventario_Sucursal_SucursalId",
                        column: x => x.SucursalId,
                        principalTable: "Sucursal",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MovimientoInventario_Usuario_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Secuencia",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmpresaId = table.Column<Guid>(type: "uuid", nullable: false),
                    SucursalId = table.Column<Guid>(type: "uuid", nullable: true),
                    Tipo = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Prefijo = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Siguiente = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Secuencia", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Secuencia_Empresa_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Secuencia_Sucursal_SucursalId",
                        column: x => x.SucursalId,
                        principalTable: "Sucursal",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "UsuarioAcceso",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmpresaId = table.Column<Guid>(type: "uuid", nullable: false),
                    SucursalId = table.Column<Guid>(type: "uuid", nullable: true),
                    RolId = table.Column<Guid>(type: "uuid", nullable: false),
                    Predeterminado = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UsuarioAcceso", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UsuarioAcceso_Empresa_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UsuarioAcceso_Rol_RolId",
                        column: x => x.RolId,
                        principalTable: "Rol",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UsuarioAcceso_Sucursal_SucursalId",
                        column: x => x.SucursalId,
                        principalTable: "Sucursal",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UsuarioAcceso_Usuario_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ClienteContacto",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClienteId = table.Column<Guid>(type: "uuid", nullable: false),
                    Nombre = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Apellidos = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Puesto = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Correo = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: true),
                    Telefono = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Principal = table.Column<bool>(type: "boolean", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClienteContacto", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClienteContacto_Cliente_ClienteId",
                        column: x => x.ClienteId,
                        principalTable: "Cliente",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClienteContacto_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClienteContacto_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClienteContacto_Usuario_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ClienteDatoFiscal",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClienteId = table.Column<Guid>(type: "uuid", nullable: false),
                    Alias = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RazonSocial = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    RFC = table.Column<string>(type: "character varying(13)", maxLength: 13, nullable: false),
                    RegimenFiscal = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    UsoCfdi = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: false),
                    CodigoPostal = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    Correo = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: true),
                    DireccionFiscal = table.Column<string>(type: "text", nullable: true),
                    Predeterminado = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClienteDatoFiscal", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClienteDatoFiscal_Cliente_ClienteId",
                        column: x => x.ClienteId,
                        principalTable: "Cliente",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClienteDatoFiscal_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClienteDatoFiscal_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Obra",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClienteId = table.Column<Guid>(type: "uuid", nullable: false),
                    Nombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Direccion = table.Column<string>(type: "text", nullable: false),
                    Municipio = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Referencias = table.Column<string>(type: "text", nullable: true),
                    Lat = table.Column<decimal>(type: "numeric(9,6)", precision: 9, scale: 6, nullable: true),
                    Lng = table.Column<decimal>(type: "numeric(9,6)", precision: 9, scale: 6, nullable: true),
                    ResponsableNombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ResponsableFotoArchivoId = table.Column<Guid>(type: "uuid", nullable: true),
                    Contactos = table.Column<JsonDocument>(type: "jsonb", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Obra", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Obra_Archivo_ResponsableFotoArchivoId",
                        column: x => x.ResponsableFotoArchivoId,
                        principalTable: "Archivo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Obra_Cliente_ClienteId",
                        column: x => x.ClienteId,
                        principalTable: "Cliente",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Obra_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Obra_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Prospecto",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganizacionId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmpresaId = table.Column<Guid>(type: "uuid", nullable: true),
                    Nombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    NombreEmpresa = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    Correo = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: true),
                    Telefono = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Origen = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    Etapa = table.Column<EtapaProspecto>(type: "etapa_prospecto", nullable: false),
                    VendedorId = table.Column<Guid>(type: "uuid", nullable: true),
                    ValorEstimado = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    ClienteId = table.Column<Guid>(type: "uuid", nullable: true),
                    MotivoPerdida = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Prospecto", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Prospecto_Cliente_ClienteId",
                        column: x => x.ClienteId,
                        principalTable: "Cliente",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Prospecto_Empresa_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Prospecto_Organizacion_OrganizacionId",
                        column: x => x.OrganizacionId,
                        principalTable: "Organizacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Prospecto_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Prospecto_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Prospecto_Usuario_VendedorId",
                        column: x => x.VendedorId,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SaldoLealtad",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProgramaId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClienteId = table.Column<Guid>(type: "uuid", nullable: false),
                    Saldo = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SaldoLealtad", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SaldoLealtad_Cliente_ClienteId",
                        column: x => x.ClienteId,
                        principalTable: "Cliente",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SaldoLealtad_ProgramaDescuento_ProgramaId",
                        column: x => x.ProgramaId,
                        principalTable: "ProgramaDescuento",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "EventoCambio",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EventoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Campo = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Etiqueta = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    TipoDato = table.Column<TipoDatoCambio>(type: "tipo_dato_cambio", nullable: false),
                    ValorAnterior = table.Column<string>(type: "text", nullable: true),
                    ValorNuevo = table.Column<string>(type: "text", nullable: true),
                    ValorAnteriorCrudo = table.Column<string>(type: "jsonb", nullable: true),
                    ValorNuevoCrudo = table.Column<string>(type: "jsonb", nullable: true),
                    Orden = table.Column<short>(type: "smallint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventoCambio", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EventoCambio_Evento_EventoId",
                        column: x => x.EventoId,
                        principalTable: "Evento",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProductoEquipo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductoId = table.Column<Guid>(type: "uuid", nullable: false),
                    EquipoId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductoEquipo", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductoEquipo_Equipo_EquipoId",
                        column: x => x.EquipoId,
                        principalTable: "Equipo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProductoEquipo_Producto_ProductoId",
                        column: x => x.ProductoId,
                        principalTable: "Producto",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Cotizacion",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmpresaId = table.Column<Guid>(type: "uuid", nullable: false),
                    SucursalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClienteId = table.Column<Guid>(type: "uuid", nullable: true),
                    ObraId = table.Column<Guid>(type: "uuid", nullable: true),
                    ContactoNombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ContactoTelefono = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    VendedorId = table.Column<Guid>(type: "uuid", nullable: true),
                    Folio = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Serie = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Revision = table.Column<int>(type: "integer", nullable: false),
                    BaseId = table.Column<Guid>(type: "uuid", nullable: true),
                    Estado = table.Column<EstadoCotizacion>(type: "estado_cotizacion", nullable: false),
                    Origen = table.Column<OrigenCotizacion>(type: "origen_cotizacion", nullable: false),
                    OcultaAlCliente = table.Column<bool>(type: "boolean", nullable: false),
                    Fecha = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    VigenciaHasta = table.Column<DateOnly>(type: "date", nullable: true),
                    MonedaCodigo = table.Column<string>(type: "character(3)", fixedLength: true, maxLength: 3, nullable: false),
                    ListaPreciosId = table.Column<Guid>(type: "uuid", nullable: true),
                    Descuento = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    Subtotal = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    Iva = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    Total = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    Notas = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Cotizacion", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Cotizacion_Cliente_ClienteId",
                        column: x => x.ClienteId,
                        principalTable: "Cliente",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Cotizacion_Cotizacion_BaseId",
                        column: x => x.BaseId,
                        principalTable: "Cotizacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Cotizacion_Empresa_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Cotizacion_ListaPrecios_ListaPreciosId",
                        column: x => x.ListaPreciosId,
                        principalTable: "ListaPrecios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Cotizacion_Moneda_MonedaCodigo",
                        column: x => x.MonedaCodigo,
                        principalTable: "Moneda",
                        principalColumn: "Codigo",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Cotizacion_Obra_ObraId",
                        column: x => x.ObraId,
                        principalTable: "Obra",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Cotizacion_Sucursal_SucursalId",
                        column: x => x.SucursalId,
                        principalTable: "Sucursal",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Cotizacion_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Cotizacion_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Cotizacion_Usuario_VendedorId",
                        column: x => x.VendedorId,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CotizacionPartida",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CotizacionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Orden = table.Column<short>(type: "smallint", nullable: false),
                    Nombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SolucionId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    ProductoId = table.Column<Guid>(type: "uuid", nullable: true),
                    TipoResistencia = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false),
                    ResistenciaKgCm2 = table.Column<short>(type: "smallint", nullable: false),
                    EdadDias = table.Column<short>(type: "smallint", nullable: false),
                    RevenimientoCm = table.Column<short>(type: "smallint", nullable: false),
                    TmaMm = table.Column<short>(type: "smallint", nullable: false),
                    Cemento = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Exposicion = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Colocacion = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Aditivos = table.Column<List<string>>(type: "text[]", nullable: false),
                    VolumenM3 = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    PrecioM3 = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    Entrega = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TrasladoDistanciaKm = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    TrasladoIncluidosKm = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    TrasladoPrecioKm = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CotizacionPartida", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CotizacionPartida_Cotizacion_CotizacionId",
                        column: x => x.CotizacionId,
                        principalTable: "Cotizacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CotizacionPartida_Producto_ProductoId",
                        column: x => x.ProductoId,
                        principalTable: "Producto",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CotizacionPartida_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CotizacionPartida_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CotizacionLinea",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PartidaId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Concepto = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Cantidad = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: false),
                    Dias = table.Column<short>(type: "smallint", nullable: true),
                    PrecioUnitario = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    Importe = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CotizacionLinea", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CotizacionLinea_CotizacionPartida_PartidaId",
                        column: x => x.PartidaId,
                        principalTable: "CotizacionPartida",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CotizacionLinea_Producto_ProductoId",
                        column: x => x.ProductoId,
                        principalTable: "Producto",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Pedido",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmpresaId = table.Column<Guid>(type: "uuid", nullable: false),
                    SucursalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClienteId = table.Column<Guid>(type: "uuid", nullable: false),
                    ObraId = table.Column<Guid>(type: "uuid", nullable: false),
                    CotizacionId = table.Column<Guid>(type: "uuid", nullable: true),
                    PartidaId = table.Column<Guid>(type: "uuid", nullable: true),
                    VendedorId = table.Column<Guid>(type: "uuid", nullable: true),
                    Folio = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    FechaHoraEntrega = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Estado = table.Column<EstadoPedido>(type: "estado_pedido", nullable: false),
                    Cobro = table.Column<EstadoCobro>(type: "estado_cobro", nullable: false),
                    MetodoPago = table.Column<MetodoPago>(type: "metodo_pago", nullable: false),
                    EstatusPlanta = table.Column<EstatusPlanta>(type: "estatus_planta", nullable: false),
                    SolicitudPlantaFecha = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SolicitudPlantaNota = table.Column<string>(type: "text", nullable: true),
                    Descuento = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    Subtotal = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    Iva = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    Total = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pedido", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Pedido_Cliente_ClienteId",
                        column: x => x.ClienteId,
                        principalTable: "Cliente",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Pedido_CotizacionPartida_PartidaId",
                        column: x => x.PartidaId,
                        principalTable: "CotizacionPartida",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Pedido_Cotizacion_CotizacionId",
                        column: x => x.CotizacionId,
                        principalTable: "Cotizacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Pedido_Empresa_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Pedido_Obra_ObraId",
                        column: x => x.ObraId,
                        principalTable: "Obra",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Pedido_Sucursal_SucursalId",
                        column: x => x.SucursalId,
                        principalTable: "Sucursal",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Pedido_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Pedido_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Pedido_Usuario_VendedorId",
                        column: x => x.VendedorId,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Cupon",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProgramaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Codigo = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ClienteId = table.Column<Guid>(type: "uuid", nullable: true),
                    GanadoEnPedidoId = table.Column<Guid>(type: "uuid", nullable: true),
                    UsadoEnPedidoId = table.Column<Guid>(type: "uuid", nullable: true),
                    UsadoEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Cupon", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Cupon_Cliente_ClienteId",
                        column: x => x.ClienteId,
                        principalTable: "Cliente",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Cupon_Pedido_GanadoEnPedidoId",
                        column: x => x.GanadoEnPedidoId,
                        principalTable: "Pedido",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Cupon_Pedido_UsadoEnPedidoId",
                        column: x => x.UsadoEnPedidoId,
                        principalTable: "Pedido",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Cupon_ProgramaDescuento_ProgramaId",
                        column: x => x.ProgramaId,
                        principalTable: "ProgramaDescuento",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Cupon_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Cupon_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PedidoLinea",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PedidoId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Descripcion = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Cantidad = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: false),
                    PrecioUnitario = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    Descuento = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    Importe = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PedidoLinea", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PedidoLinea_Pedido_PedidoId",
                        column: x => x.PedidoId,
                        principalTable: "Pedido",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PedidoLinea_Producto_ProductoId",
                        column: x => x.ProductoId,
                        principalTable: "Producto",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Remision",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PedidoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Folio = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    EquipoId = table.Column<Guid>(type: "uuid", nullable: true),
                    OperadorId = table.Column<Guid>(type: "uuid", nullable: true),
                    OperadorNombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    VolumenM3 = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    Estado = table.Column<EstadoViaje>(type: "estado_viaje", nullable: false),
                    SalidaEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LlegadaEstimada = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LlegadaEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TerminadaEn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FirmaArchivoId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Remision", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Remision_Archivo_FirmaArchivoId",
                        column: x => x.FirmaArchivoId,
                        principalTable: "Archivo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Remision_Equipo_EquipoId",
                        column: x => x.EquipoId,
                        principalTable: "Equipo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Remision_Pedido_PedidoId",
                        column: x => x.PedidoId,
                        principalTable: "Pedido",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Remision_Usuario_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Remision_Usuario_OperadorId",
                        column: x => x.OperadorId,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Remision_Usuario_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Actividad_AsignadaAId_FechaLimite",
                table: "Actividad",
                columns: new[] { "AsignadaAId", "FechaLimite" });

            migrationBuilder.CreateIndex(
                name: "IX_Actividad_CreatedById",
                table: "Actividad",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Actividad_OrganizacionId",
                table: "Actividad",
                column: "OrganizacionId");

            migrationBuilder.CreateIndex(
                name: "IX_Actividad_RegistroTipo_RegistroId",
                table: "Actividad",
                columns: new[] { "RegistroTipo", "RegistroId" });

            migrationBuilder.CreateIndex(
                name: "IX_Actividad_UpdatedById",
                table: "Actividad",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Archivo_CreatedById",
                table: "Archivo",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Archivo_OrganizacionId",
                table: "Archivo",
                column: "OrganizacionId");

            migrationBuilder.CreateIndex(
                name: "IX_Archivo_RegistroTipo_RegistroId",
                table: "Archivo",
                columns: new[] { "RegistroTipo", "RegistroId" });

            migrationBuilder.CreateIndex(
                name: "IX_Archivo_SubidoPorId",
                table: "Archivo",
                column: "SubidoPorId");

            migrationBuilder.CreateIndex(
                name: "IX_Archivo_UpdatedById",
                table: "Archivo",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_CategoriaProducto_CreatedById",
                table: "CategoriaProducto",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_CategoriaProducto_OrganizacionId",
                table: "CategoriaProducto",
                column: "OrganizacionId");

            migrationBuilder.CreateIndex(
                name: "IX_CategoriaProducto_UpdatedById",
                table: "CategoriaProducto",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Cliente_CreatedById",
                table: "Cliente",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Cliente_EmpresaRestringidaId",
                table: "Cliente",
                column: "EmpresaRestringidaId");

            migrationBuilder.CreateIndex(
                name: "IX_Cliente_ListaPreciosId",
                table: "Cliente",
                column: "ListaPreciosId");

            migrationBuilder.CreateIndex(
                name: "IX_Cliente_OrganizacionId_Nombre",
                table: "Cliente",
                columns: new[] { "OrganizacionId", "Nombre" });

            migrationBuilder.CreateIndex(
                name: "IX_Cliente_UpdatedById",
                table: "Cliente",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Cliente_VendedorId",
                table: "Cliente",
                column: "VendedorId");

            migrationBuilder.CreateIndex(
                name: "IX_ClienteContacto_ClienteId",
                table: "ClienteContacto",
                column: "ClienteId");

            migrationBuilder.CreateIndex(
                name: "IX_ClienteContacto_CreatedById",
                table: "ClienteContacto",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_ClienteContacto_UpdatedById",
                table: "ClienteContacto",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_ClienteContacto_UsuarioId",
                table: "ClienteContacto",
                column: "UsuarioId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ClienteDatoFiscal_ClienteId",
                table: "ClienteDatoFiscal",
                column: "ClienteId");

            migrationBuilder.CreateIndex(
                name: "IX_ClienteDatoFiscal_CreatedById",
                table: "ClienteDatoFiscal",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_ClienteDatoFiscal_UpdatedById",
                table: "ClienteDatoFiscal",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Cotizacion_BaseId",
                table: "Cotizacion",
                column: "BaseId");

            migrationBuilder.CreateIndex(
                name: "IX_Cotizacion_ClienteId_Fecha",
                table: "Cotizacion",
                columns: new[] { "ClienteId", "Fecha" });

            migrationBuilder.CreateIndex(
                name: "IX_Cotizacion_CreatedById",
                table: "Cotizacion",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Cotizacion_EmpresaId_Folio",
                table: "Cotizacion",
                columns: new[] { "EmpresaId", "Folio" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Cotizacion_ListaPreciosId",
                table: "Cotizacion",
                column: "ListaPreciosId");

            migrationBuilder.CreateIndex(
                name: "IX_Cotizacion_MonedaCodigo",
                table: "Cotizacion",
                column: "MonedaCodigo");

            migrationBuilder.CreateIndex(
                name: "IX_Cotizacion_ObraId",
                table: "Cotizacion",
                column: "ObraId");

            migrationBuilder.CreateIndex(
                name: "IX_Cotizacion_SucursalId",
                table: "Cotizacion",
                column: "SucursalId");

            migrationBuilder.CreateIndex(
                name: "IX_Cotizacion_UpdatedById",
                table: "Cotizacion",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Cotizacion_VendedorId",
                table: "Cotizacion",
                column: "VendedorId");

            migrationBuilder.CreateIndex(
                name: "IX_CotizacionLinea_PartidaId",
                table: "CotizacionLinea",
                column: "PartidaId");

            migrationBuilder.CreateIndex(
                name: "IX_CotizacionLinea_ProductoId",
                table: "CotizacionLinea",
                column: "ProductoId");

            migrationBuilder.CreateIndex(
                name: "IX_CotizacionPartida_CotizacionId",
                table: "CotizacionPartida",
                column: "CotizacionId");

            migrationBuilder.CreateIndex(
                name: "IX_CotizacionPartida_CreatedById",
                table: "CotizacionPartida",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_CotizacionPartida_ProductoId",
                table: "CotizacionPartida",
                column: "ProductoId");

            migrationBuilder.CreateIndex(
                name: "IX_CotizacionPartida_UpdatedById",
                table: "CotizacionPartida",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Cupon_ClienteId",
                table: "Cupon",
                column: "ClienteId");

            migrationBuilder.CreateIndex(
                name: "IX_Cupon_Codigo",
                table: "Cupon",
                column: "Codigo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Cupon_CreatedById",
                table: "Cupon",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Cupon_GanadoEnPedidoId",
                table: "Cupon",
                column: "GanadoEnPedidoId");

            migrationBuilder.CreateIndex(
                name: "IX_Cupon_ProgramaId",
                table: "Cupon",
                column: "ProgramaId");

            migrationBuilder.CreateIndex(
                name: "IX_Cupon_UpdatedById",
                table: "Cupon",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Cupon_UsadoEnPedidoId",
                table: "Cupon",
                column: "UsadoEnPedidoId");

            migrationBuilder.CreateIndex(
                name: "IX_Empresa_CreatedById",
                table: "Empresa",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Empresa_CsdCerArchivoId",
                table: "Empresa",
                column: "CsdCerArchivoId");

            migrationBuilder.CreateIndex(
                name: "IX_Empresa_CsdKeyArchivoId",
                table: "Empresa",
                column: "CsdKeyArchivoId");

            migrationBuilder.CreateIndex(
                name: "IX_Empresa_LogoArchivoId",
                table: "Empresa",
                column: "LogoArchivoId");

            migrationBuilder.CreateIndex(
                name: "IX_Empresa_MonedaCodigo",
                table: "Empresa",
                column: "MonedaCodigo");

            migrationBuilder.CreateIndex(
                name: "IX_Empresa_OrganizacionId_RFC",
                table: "Empresa",
                columns: new[] { "OrganizacionId", "RFC" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Empresa_UpdatedById",
                table: "Empresa",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Equipo_CreatedById",
                table: "Equipo",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Equipo_SucursalId_NumeroEconomico",
                table: "Equipo",
                columns: new[] { "SucursalId", "NumeroEconomico" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Equipo_UpdatedById",
                table: "Equipo",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Evento_AutorId_Fecha",
                table: "Evento",
                columns: new[] { "AutorId", "Fecha" });

            migrationBuilder.CreateIndex(
                name: "IX_Evento_OrganizacionId",
                table: "Evento",
                column: "OrganizacionId");

            migrationBuilder.CreateIndex(
                name: "IX_Evento_RegistroPadreTipo_RegistroPadreId_Fecha",
                table: "Evento",
                columns: new[] { "RegistroPadreTipo", "RegistroPadreId", "Fecha" });

            migrationBuilder.CreateIndex(
                name: "IX_Evento_RegistroTipo_RegistroId_Fecha",
                table: "Evento",
                columns: new[] { "RegistroTipo", "RegistroId", "Fecha" });

            migrationBuilder.CreateIndex(
                name: "IX_Evento_SesionId",
                table: "Evento",
                column: "SesionId");

            migrationBuilder.CreateIndex(
                name: "IX_EventoCambio_Campo",
                table: "EventoCambio",
                column: "Campo");

            migrationBuilder.CreateIndex(
                name: "IX_EventoCambio_EventoId",
                table: "EventoCambio",
                column: "EventoId");

            migrationBuilder.CreateIndex(
                name: "IX_Existencia_ProductoId_SucursalId",
                table: "Existencia",
                columns: new[] { "ProductoId", "SucursalId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Existencia_SucursalId",
                table: "Existencia",
                column: "SucursalId");

            migrationBuilder.CreateIndex(
                name: "IX_Impuesto_CreatedById",
                table: "Impuesto",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Impuesto_EmpresaId",
                table: "Impuesto",
                column: "EmpresaId");

            migrationBuilder.CreateIndex(
                name: "IX_Impuesto_UpdatedById",
                table: "Impuesto",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_ListaPrecios_CreatedById",
                table: "ListaPrecios",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_ListaPrecios_EmpresaRestringidaId",
                table: "ListaPrecios",
                column: "EmpresaRestringidaId");

            migrationBuilder.CreateIndex(
                name: "IX_ListaPrecios_MonedaCodigo",
                table: "ListaPrecios",
                column: "MonedaCodigo");

            migrationBuilder.CreateIndex(
                name: "IX_ListaPrecios_OrganizacionId",
                table: "ListaPrecios",
                column: "OrganizacionId");

            migrationBuilder.CreateIndex(
                name: "IX_ListaPrecios_UpdatedById",
                table: "ListaPrecios",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_ListaPreciosSucursal_ListaPreciosId_SucursalId",
                table: "ListaPreciosSucursal",
                columns: new[] { "ListaPreciosId", "SucursalId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ListaPreciosSucursal_SucursalId",
                table: "ListaPreciosSucursal",
                column: "SucursalId");

            migrationBuilder.CreateIndex(
                name: "IX_MovimientoInventario_ProductoId_SucursalId_Fecha",
                table: "MovimientoInventario",
                columns: new[] { "ProductoId", "SucursalId", "Fecha" });

            migrationBuilder.CreateIndex(
                name: "IX_MovimientoInventario_SucursalId",
                table: "MovimientoInventario",
                column: "SucursalId");

            migrationBuilder.CreateIndex(
                name: "IX_MovimientoInventario_UsuarioId",
                table: "MovimientoInventario",
                column: "UsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_Obra_ClienteId",
                table: "Obra",
                column: "ClienteId");

            migrationBuilder.CreateIndex(
                name: "IX_Obra_CreatedById",
                table: "Obra",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Obra_ResponsableFotoArchivoId",
                table: "Obra",
                column: "ResponsableFotoArchivoId");

            migrationBuilder.CreateIndex(
                name: "IX_Obra_UpdatedById",
                table: "Obra",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Organizacion_CreatedById",
                table: "Organizacion",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Organizacion_LogoArchivoId",
                table: "Organizacion",
                column: "LogoArchivoId");

            migrationBuilder.CreateIndex(
                name: "IX_Organizacion_Slug",
                table: "Organizacion",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Organizacion_UpdatedById",
                table: "Organizacion",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Pedido_ClienteId",
                table: "Pedido",
                column: "ClienteId");

            migrationBuilder.CreateIndex(
                name: "IX_Pedido_Cobro",
                table: "Pedido",
                column: "Cobro");

            migrationBuilder.CreateIndex(
                name: "IX_Pedido_CotizacionId",
                table: "Pedido",
                column: "CotizacionId");

            migrationBuilder.CreateIndex(
                name: "IX_Pedido_CreatedById",
                table: "Pedido",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Pedido_EmpresaId_Folio",
                table: "Pedido",
                columns: new[] { "EmpresaId", "Folio" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Pedido_ObraId",
                table: "Pedido",
                column: "ObraId");

            migrationBuilder.CreateIndex(
                name: "IX_Pedido_PartidaId",
                table: "Pedido",
                column: "PartidaId");

            migrationBuilder.CreateIndex(
                name: "IX_Pedido_SucursalId_FechaHoraEntrega",
                table: "Pedido",
                columns: new[] { "SucursalId", "FechaHoraEntrega" });

            migrationBuilder.CreateIndex(
                name: "IX_Pedido_UpdatedById",
                table: "Pedido",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Pedido_VendedorId",
                table: "Pedido",
                column: "VendedorId");

            migrationBuilder.CreateIndex(
                name: "IX_PedidoLinea_PedidoId",
                table: "PedidoLinea",
                column: "PedidoId");

            migrationBuilder.CreateIndex(
                name: "IX_PedidoLinea_ProductoId",
                table: "PedidoLinea",
                column: "ProductoId");

            migrationBuilder.CreateIndex(
                name: "IX_Producto_CategoriaId",
                table: "Producto",
                column: "CategoriaId");

            migrationBuilder.CreateIndex(
                name: "IX_Producto_CreatedById",
                table: "Producto",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Producto_EmpresaRestringidaId",
                table: "Producto",
                column: "EmpresaRestringidaId");

            migrationBuilder.CreateIndex(
                name: "IX_Producto_MonedaCodigo",
                table: "Producto",
                column: "MonedaCodigo");

            migrationBuilder.CreateIndex(
                name: "IX_Producto_OrganizacionId_Codigo",
                table: "Producto",
                columns: new[] { "OrganizacionId", "Codigo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Producto_UnidadId",
                table: "Producto",
                column: "UnidadId");

            migrationBuilder.CreateIndex(
                name: "IX_Producto_UpdatedById",
                table: "Producto",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_ProductoEquipo_EquipoId",
                table: "ProductoEquipo",
                column: "EquipoId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductoEquipo_ProductoId_EquipoId",
                table: "ProductoEquipo",
                columns: new[] { "ProductoId", "EquipoId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProgramaDescuento_CategoriaId",
                table: "ProgramaDescuento",
                column: "CategoriaId");

            migrationBuilder.CreateIndex(
                name: "IX_ProgramaDescuento_CreatedById",
                table: "ProgramaDescuento",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_ProgramaDescuento_EmpresaRestringidaId",
                table: "ProgramaDescuento",
                column: "EmpresaRestringidaId");

            migrationBuilder.CreateIndex(
                name: "IX_ProgramaDescuento_OrganizacionId",
                table: "ProgramaDescuento",
                column: "OrganizacionId");

            migrationBuilder.CreateIndex(
                name: "IX_ProgramaDescuento_ProductoId",
                table: "ProgramaDescuento",
                column: "ProductoId");

            migrationBuilder.CreateIndex(
                name: "IX_ProgramaDescuento_UpdatedById",
                table: "ProgramaDescuento",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Prospecto_ClienteId",
                table: "Prospecto",
                column: "ClienteId");

            migrationBuilder.CreateIndex(
                name: "IX_Prospecto_CreatedById",
                table: "Prospecto",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Prospecto_EmpresaId",
                table: "Prospecto",
                column: "EmpresaId");

            migrationBuilder.CreateIndex(
                name: "IX_Prospecto_OrganizacionId",
                table: "Prospecto",
                column: "OrganizacionId");

            migrationBuilder.CreateIndex(
                name: "IX_Prospecto_UpdatedById",
                table: "Prospecto",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Prospecto_VendedorId",
                table: "Prospecto",
                column: "VendedorId");

            migrationBuilder.CreateIndex(
                name: "IX_ReglaPrecio_CategoriaId",
                table: "ReglaPrecio",
                column: "CategoriaId");

            migrationBuilder.CreateIndex(
                name: "IX_ReglaPrecio_CreatedById",
                table: "ReglaPrecio",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_ReglaPrecio_ListaPreciosId",
                table: "ReglaPrecio",
                column: "ListaPreciosId");

            migrationBuilder.CreateIndex(
                name: "IX_ReglaPrecio_ProductoId",
                table: "ReglaPrecio",
                column: "ProductoId");

            migrationBuilder.CreateIndex(
                name: "IX_ReglaPrecio_UpdatedById",
                table: "ReglaPrecio",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Remision_CreatedById",
                table: "Remision",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Remision_EquipoId",
                table: "Remision",
                column: "EquipoId");

            migrationBuilder.CreateIndex(
                name: "IX_Remision_FirmaArchivoId",
                table: "Remision",
                column: "FirmaArchivoId");

            migrationBuilder.CreateIndex(
                name: "IX_Remision_OperadorId",
                table: "Remision",
                column: "OperadorId");

            migrationBuilder.CreateIndex(
                name: "IX_Remision_PedidoId",
                table: "Remision",
                column: "PedidoId");

            migrationBuilder.CreateIndex(
                name: "IX_Remision_UpdatedById",
                table: "Remision",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Rol_CreatedById",
                table: "Rol",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Rol_OrganizacionId",
                table: "Rol",
                column: "OrganizacionId");

            migrationBuilder.CreateIndex(
                name: "IX_Rol_UpdatedById",
                table: "Rol",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_RolPermiso_RolId_Permiso",
                table: "RolPermiso",
                columns: new[] { "RolId", "Permiso" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SaldoLealtad_ClienteId",
                table: "SaldoLealtad",
                column: "ClienteId");

            migrationBuilder.CreateIndex(
                name: "IX_SaldoLealtad_ProgramaId_ClienteId",
                table: "SaldoLealtad",
                columns: new[] { "ProgramaId", "ClienteId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Secuencia_EmpresaId_SucursalId_Tipo",
                table: "Secuencia",
                columns: new[] { "EmpresaId", "SucursalId", "Tipo" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.CreateIndex(
                name: "IX_Secuencia_SucursalId",
                table: "Secuencia",
                column: "SucursalId");

            migrationBuilder.CreateIndex(
                name: "IX_Seguidor_RegistroTipo_RegistroId_UsuarioId",
                table: "Seguidor",
                columns: new[] { "RegistroTipo", "RegistroId", "UsuarioId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Seguidor_UsuarioId",
                table: "Seguidor",
                column: "UsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_Sesion_EmpresaId",
                table: "Sesion",
                column: "EmpresaId");

            migrationBuilder.CreateIndex(
                name: "IX_Sesion_RefreshTokenHash",
                table: "Sesion",
                column: "RefreshTokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sesion_UsuarioId_CreadaEn",
                table: "Sesion",
                columns: new[] { "UsuarioId", "CreadaEn" });

            migrationBuilder.CreateIndex(
                name: "IX_Sucursal_CreatedById",
                table: "Sucursal",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Sucursal_EmpresaId_Codigo",
                table: "Sucursal",
                columns: new[] { "EmpresaId", "Codigo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sucursal_UpdatedById",
                table: "Sucursal",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_UnidadMedida_Clave",
                table: "UnidadMedida",
                column: "Clave",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Usuario_Correo",
                table: "Usuario",
                column: "Correo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Usuario_CreatedById",
                table: "Usuario",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Usuario_FotoArchivoId",
                table: "Usuario",
                column: "FotoArchivoId");

            migrationBuilder.CreateIndex(
                name: "IX_Usuario_UpdatedById",
                table: "Usuario",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_UsuarioAcceso_EmpresaId",
                table: "UsuarioAcceso",
                column: "EmpresaId");

            migrationBuilder.CreateIndex(
                name: "IX_UsuarioAcceso_RolId",
                table: "UsuarioAcceso",
                column: "RolId");

            migrationBuilder.CreateIndex(
                name: "IX_UsuarioAcceso_SucursalId",
                table: "UsuarioAcceso",
                column: "SucursalId");

            migrationBuilder.CreateIndex(
                name: "IX_UsuarioAcceso_UsuarioId_EmpresaId_SucursalId",
                table: "UsuarioAcceso",
                columns: new[] { "UsuarioId", "EmpresaId", "SucursalId" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.AddForeignKey(
                name: "FK_Actividad_Organizacion_OrganizacionId",
                table: "Actividad",
                column: "OrganizacionId",
                principalTable: "Organizacion",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Actividad_Usuario_AsignadaAId",
                table: "Actividad",
                column: "AsignadaAId",
                principalTable: "Usuario",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Actividad_Usuario_CreatedById",
                table: "Actividad",
                column: "CreatedById",
                principalTable: "Usuario",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Actividad_Usuario_UpdatedById",
                table: "Actividad",
                column: "UpdatedById",
                principalTable: "Usuario",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Archivo_Organizacion_OrganizacionId",
                table: "Archivo",
                column: "OrganizacionId",
                principalTable: "Organizacion",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Archivo_Usuario_CreatedById",
                table: "Archivo",
                column: "CreatedById",
                principalTable: "Usuario",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Archivo_Usuario_SubidoPorId",
                table: "Archivo",
                column: "SubidoPorId",
                principalTable: "Usuario",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Archivo_Usuario_UpdatedById",
                table: "Archivo",
                column: "UpdatedById",
                principalTable: "Usuario",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Archivo_Organizacion_OrganizacionId",
                table: "Archivo");

            migrationBuilder.DropForeignKey(
                name: "FK_Archivo_Usuario_CreatedById",
                table: "Archivo");

            migrationBuilder.DropForeignKey(
                name: "FK_Archivo_Usuario_SubidoPorId",
                table: "Archivo");

            migrationBuilder.DropForeignKey(
                name: "FK_Archivo_Usuario_UpdatedById",
                table: "Archivo");

            migrationBuilder.DropTable(
                name: "Actividad");

            migrationBuilder.DropTable(
                name: "ClienteContacto");

            migrationBuilder.DropTable(
                name: "ClienteDatoFiscal");

            migrationBuilder.DropTable(
                name: "CotizacionLinea");

            migrationBuilder.DropTable(
                name: "Cupon");

            migrationBuilder.DropTable(
                name: "EventoCambio");

            migrationBuilder.DropTable(
                name: "Existencia");

            migrationBuilder.DropTable(
                name: "Impuesto");

            migrationBuilder.DropTable(
                name: "ListaPreciosSucursal");

            migrationBuilder.DropTable(
                name: "MovimientoInventario");

            migrationBuilder.DropTable(
                name: "PedidoLinea");

            migrationBuilder.DropTable(
                name: "ProductoEquipo");

            migrationBuilder.DropTable(
                name: "Prospecto");

            migrationBuilder.DropTable(
                name: "ReglaPrecio");

            migrationBuilder.DropTable(
                name: "Remision");

            migrationBuilder.DropTable(
                name: "RolPermiso");

            migrationBuilder.DropTable(
                name: "SaldoLealtad");

            migrationBuilder.DropTable(
                name: "Secuencia");

            migrationBuilder.DropTable(
                name: "Seguidor");

            migrationBuilder.DropTable(
                name: "UsuarioAcceso");

            migrationBuilder.DropTable(
                name: "Evento");

            migrationBuilder.DropTable(
                name: "Equipo");

            migrationBuilder.DropTable(
                name: "Pedido");

            migrationBuilder.DropTable(
                name: "ProgramaDescuento");

            migrationBuilder.DropTable(
                name: "Rol");

            migrationBuilder.DropTable(
                name: "Sesion");

            migrationBuilder.DropTable(
                name: "CotizacionPartida");

            migrationBuilder.DropTable(
                name: "Cotizacion");

            migrationBuilder.DropTable(
                name: "Producto");

            migrationBuilder.DropTable(
                name: "Obra");

            migrationBuilder.DropTable(
                name: "Sucursal");

            migrationBuilder.DropTable(
                name: "CategoriaProducto");

            migrationBuilder.DropTable(
                name: "UnidadMedida");

            migrationBuilder.DropTable(
                name: "Cliente");

            migrationBuilder.DropTable(
                name: "ListaPrecios");

            migrationBuilder.DropTable(
                name: "Empresa");

            migrationBuilder.DropTable(
                name: "Moneda");

            migrationBuilder.DropTable(
                name: "Organizacion");

            migrationBuilder.DropTable(
                name: "Usuario");

            migrationBuilder.DropTable(
                name: "Archivo");
        }
    }
}
