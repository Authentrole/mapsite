using System;
using MapsAPI.Entities.eGIS;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

#nullable disable

namespace MapsAPI.Contexts
{
    public partial class UFTDBContext : DbContext
    {
        public UFTDBContext()
        {
        }

        public UFTDBContext(DbContextOptions<UFTDBContext> options)
            : base(options)
        {
        }

        public virtual DbSet<EgisAppUsage> EgisAppUsages { get; set; }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            if (!optionsBuilder.IsConfigured)
            {
//                optionsBuilder.UseOracle("Data Source=(DESCRIPTION = (ADDRESS = (PROTOCOL = TCP)(HOST = ageeditddb1.conedison.net)(PORT = 1521)) (CONNECT_DATA = (SERVER = DEDICATED) (SERVICE_NAME = GUAMDEV)));User Id=uft_admin; Password=uft_admin");
            }
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.HasDefaultSchema(GlobalVars.UFT_Schema_Name)
                .HasAnnotation("Relational:Collation", "USING_NLS_COMP");

            modelBuilder.Entity<EgisAppUsage>(entity =>
            {
                entity.ToTable("EGIS_APP_USAGE");

                entity.Property(e => e.Id)
                    .HasColumnType("NUMBER")
                    .ValueGeneratedOnAdd()
                    .HasColumnName("ID");

                entity.Property(e => e.AppName)
                    .HasMaxLength(50)
                    .IsUnicode(false)
                    .HasColumnName("APP_NAME");

                entity.Property(e => e.ConnectedDate)
                    .HasPrecision(6)
                    .HasColumnName("CONNECTED_DATE");

                entity.Property(e => e.Environment)
                    .HasMaxLength(20)
                    .IsUnicode(false)
                    .HasColumnName("ENVIRONMENT");

                entity.Property(e => e.MachineName)
                    .HasMaxLength(50)
                    .IsUnicode(false)
                    .HasColumnName("MACHINE_NAME");

                entity.Property(e => e.UserName)
                    .HasMaxLength(50)
                    .IsUnicode(false)
                    .HasColumnName("USER_NAME");
                entity.Property(e => e.Page)
                    .HasMaxLength(100)
                    .IsUnicode(false)
                    .HasColumnName("PAGE");
            });

            modelBuilder.HasSequence("HEALTHCHECK_DESKTOP_PERF_ID_SEQ");

            modelBuilder.HasSequence("HEALTHCHECK_DXI_PERFORMANCE_SEQ");

            modelBuilder.HasSequence("HEALTHCHECK_MOBILE_PERF_ID_SEQ");

            modelBuilder.HasSequence("HEALTHCHECK_PROD_DESKTOP_PERF_ID_SEQ");

            modelBuilder.HasSequence("HEALTHCHECK_PROD_MOBILE_PERF_ID_SEQ");

            modelBuilder.HasSequence("HEALTHCHECK_PROD_SESSIONS_ID_SEQ");

            modelBuilder.HasSequence("HEALTHCHECK_PROD_WEB_PERF_ID_SEQ");

            modelBuilder.HasSequence("HEALTHCHECK_SESSIONS_ID_SEQ");

            modelBuilder.HasSequence("HEALTHCHECK_WEB_PERF_ID_SEQ");

            modelBuilder.HasSequence("SESSION_POSTING_TRENDS_SEQ");

            modelBuilder.HasSequence("UFT_TIMINGS_DEMO_ID_SEQ");

            OnModelCreatingPartial(modelBuilder);
        }

        partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
    }
}
