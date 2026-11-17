using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EPICO.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class VocabularioPartidas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Partidas con el vocabulario del front: exposicion normal|humedad|marina, colocacion directa|bombeable,
            // aditivos = clave del producto en minúsculas.
            migrationBuilder.Sql("""
                UPDATE "CotizacionPartida" SET
                    "Exposicion" = lower("Exposicion"),
                    "Colocacion" = CASE lower("Colocacion") WHEN 'bombeo' THEN 'bombeable' ELSE lower("Colocacion") END,
                    "Aditivos" = ARRAY(SELECT lower(a) FROM unnest("Aditivos") a)
                WHERE "Exposicion" <> lower("Exposicion") OR "Colocacion" NOT IN ('directa', 'bombeable')
                   OR EXISTS (SELECT 1 FROM unnest("Aditivos") a WHERE a <> lower(a));
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
