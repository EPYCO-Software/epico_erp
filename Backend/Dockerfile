# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first so Docker can reuse the NuGet layer while source files change.
COPY Backend/EPICO_ERP.slnx Backend/
COPY Backend/src/EPICO.Api/EPICO.Api.csproj Backend/src/EPICO.Api/
COPY Backend/src/EPICO.Application/EPICO.Application.csproj Backend/src/EPICO.Application/
COPY Backend/src/EPICO.Contracts/EPICO.Contracts.csproj Backend/src/EPICO.Contracts/
COPY Backend/src/EPICO.Domain/EPICO.Domain.csproj Backend/src/EPICO.Domain/
COPY Backend/src/EPICO.Infrastructure/EPICO.Infrastructure.csproj Backend/src/EPICO.Infrastructure/
RUN dotnet restore Backend/src/EPICO.Api/EPICO.Api.csproj

COPY Backend/ Backend/
RUN dotnet publish Backend/src/EPICO.Api/EPICO.Api.csproj \
    --configuration Release \
    --output /app/publish \
    --no-restore \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
RUN apt-get update \
    && apt-get install --yes --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/publish .

LABEL org.opencontainers.image.source="https://github.com/EPYCO-Software/epico_erp"
LABEL org.opencontainers.image.description="API de EPICO ERP"

ENV ASPNETCORE_HTTP_PORTS=8080 \
    ASPNETCORE_ENVIRONMENT=Production

EXPOSE 8080
USER $APP_UID

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl --fail --silent http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "EPICO.Api.dll"]

