using System;
using MapsAPI.Entities.Maps;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

#nullable disable

namespace MapsAPI.Contexts
{
    public partial class MapsDBContext : DbContext
    {
        public MapsDBContext()
        {
        }

        public MapsDBContext(DbContextOptions<MapsDBContext> options)
            : base(options)
        {
        }

        public virtual DbSet<Maptemplate> Maptemplates { get; set; }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            if (!optionsBuilder.IsConfigured)
            {
            }
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.HasDefaultSchema(GlobalVars.Maps_Schema_Name)
                .HasAnnotation("Relational:Collation", "USING_NLS_COMP");

            modelBuilder.Entity<Maptemplate>(entity =>
            {
                entity.HasNoKey();

                entity.ToTable("MAPTEMPLATE");

                entity.Property(e => e.Mapid)
                    .HasMaxLength(20)
                    .HasColumnName("MAPID");

                entity.Property(e => e.Pagetemplate)
                    .HasMaxLength(33)
                    .HasColumnName("PAGETEMPLATE");
            });

            modelBuilder.HasSequence("AM_LINKS_SEQ");

            modelBuilder.HasSequence("KH_ANNOUNCEMENTS_SEQ");

            modelBuilder.HasSequence("KH_APPLICATIONS_SEQ");

            modelBuilder.HasSequence("KH_FAQS_SEQ");

            modelBuilder.HasSequence("KH_LINKS_SEQ");

            modelBuilder.HasSequence("KH_RESOURCES_ARCHIVE_SEQ");

            modelBuilder.HasSequence("KH_RESOURCES_SEQ");

            modelBuilder.HasSequence("KH_TAGS_SEQ");

            modelBuilder.HasSequence("KH_TEAM_DETAILS_SEQ");

            modelBuilder.HasSequence("KH_USER_ROLES_SEQ");

            modelBuilder.HasSequence("KH_USERS_SEQ");

            OnModelCreatingPartial(modelBuilder);
        }

        partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
    }
}
