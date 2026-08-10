using System;
using System.Collections.Generic;
using MapsAPI.Entities.Microstation;
using Microsoft.EntityFrameworkCore;

namespace MapsAPI.Contexts;

public partial class MicrostationDBContext : DbContext
{
    public MicrostationDBContext()
    {
    }

    public MicrostationDBContext(DbContextOptions<MicrostationDBContext> options)
        : base(options)
    {
    }

    public virtual DbSet<LayoutNextseqBase> LayoutNextseqBases { get; set; }

    public virtual DbSet<LayoutNextseqYear> LayoutNextseqYears { get; set; }

    public virtual DbSet<LayoutType> LayoutTypes { get; set; }

    public virtual DbSet<LayoutnumLog> LayoutnumLogs { get; set; }

    public virtual DbSet<Municipal> Municipals { get; set; }

    public virtual DbSet<NetworkName> NetworkNames { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {

        if (!optionsBuilder.IsConfigured)
        {
        //     #warning To protect potentially sensitive information in your connection string, you should move it out of source code. You can avoid scaffolding the connection string by using the Name= syntax to read it from configuration - see https://go.microsoft.com/fwlink/?linkid=2131148. For more guidance on storing connection strings, see https://go.microsoft.com/fwlink/?LinkId=723263.
        //=> optionsBuilder.UseOracle("Data Source=(DESCRIPTION = (ADDRESS = (PROTOCOL = TCP)(HOST = ELFSDBDEV)(PORT = 1521)) (CONNECT_DATA = (SERVER = DEDICATED) (SERVICE_NAME = MAPDBDEV.world)));User Id=man_sup; Password=man123");

        }
    }
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder
            .HasDefaultSchema(GlobalVars.Microstation_Schema_Name)
            .UseCollation("USING_NLS_COMP");

        modelBuilder.Entity<LayoutNextseqBase>(entity =>
        {
            entity.HasKey(e => new { e.Division, e.LayoutClass, e.InitSeq }).HasName("NEXTSEQ_BASE_PK");

            entity.ToTable("LAYOUT_NEXTSEQ_BASE");

            entity.Property(e => e.Division)
                .HasMaxLength(2)
                .IsUnicode(false)
                .HasColumnName("DIVISION");
            entity.Property(e => e.LayoutClass)
                .HasMaxLength(24)
                .IsUnicode(false)
                .HasColumnName("LAYOUT_CLASS");
            entity.Property(e => e.InitSeq)
                .HasPrecision(8)
                .HasColumnName("INIT_SEQ");
            entity.Property(e => e.LastUpdateDate)
                .HasColumnType("DATE")
                .HasColumnName("LAST_UPDATE_DATE");
        });

        modelBuilder.Entity<LayoutNextseqYear>(entity =>
        {
            entity.HasKey(e => new { e.Division, e.LayoutClass, e.LayoutYear }).HasName("NEXTSEQ_YEAR_PK");
            entity
                //.HasNoKey()                
                .ToTable("LAYOUT_NEXTSEQ_YEAR");

            entity.Property(e => e.CurrentSeq)
                .HasPrecision(8)
                .HasColumnName("CURRENT_SEQ");
            entity.Property(e => e.Division)
                .IsRequired()
                .HasMaxLength(2)
                .IsUnicode(false)
                .HasColumnName("DIVISION");
            entity.Property(e => e.LastUsedDate)
                .HasColumnType("DATE")
                .HasColumnName("LAST_USED_DATE");
            entity.Property(e => e.LastUser)
                .HasMaxLength(45)
                .IsUnicode(false)
                .HasColumnName("LAST_USER");
            entity.Property(e => e.LayoutClass)
                .IsRequired()
                .HasMaxLength(24)
                .IsUnicode(false)
                .HasColumnName("LAYOUT_CLASS");
            entity.Property(e => e.LayoutYear)
                .HasPrecision(4)
                .HasColumnName("LAYOUT_YEAR");
        });

        modelBuilder.Entity<LayoutType>(entity =>
        {
            entity.HasKey(e => e.LayoutType1).HasName("LAYOUT_TYPE_PK");

            entity.ToTable("LAYOUT_TYPE");

            entity.Property(e => e.LayoutType1)
                .HasMaxLength(2)
                .IsUnicode(false)
                .HasColumnName("LAYOUT_TYPE");
            entity.Property(e => e.LayoutTypeDescription)
                .HasMaxLength(250)
                .IsUnicode(false)
                .HasColumnName("LAYOUT_TYPE_DESCRIPTION");
            entity.Property(e => e.Status)
                .HasMaxLength(32)
                .IsUnicode(false)
                .HasColumnName("STATUS");
            entity.Property(e => e.UpdateDate)
                .HasColumnType("DATE")
                .HasColumnName("UPDATE_DATE");
            entity.Property(e => e.UserId)
                .HasMaxLength(32)
                .IsUnicode(false)
                .HasColumnName("USER_ID");
        });

        modelBuilder.Entity<LayoutnumLog>(entity =>
        {
            entity.HasKey(e => new { e.Division, e.LayoutClass, e.LayoutNum }).HasName("LAYOUTNUM_LOG_PK");

            entity.ToTable("LAYOUTNUM_LOG");

            entity.Property(e => e.Division)
                .HasMaxLength(2)
                .IsUnicode(false)
                .HasColumnName("DIVISION");
            entity.Property(e => e.LayoutClass)
                .HasMaxLength(24)
                .IsUnicode(false)
                .HasColumnName("LAYOUT_CLASS");
            entity.Property(e => e.LayoutNum)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasColumnName("LAYOUT_NUM");
            entity.Property(e => e.EventNum)
                .HasMaxLength(100)
                .IsUnicode(false)
                .HasColumnName("EVENT_NUM");
            entity.Property(e => e.McNum)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("MC_NUM");
            entity.Property(e => e.SectionNum)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasColumnName("SECTION_NUM");
            entity.Property(e => e.LayoutApp)
                .HasMaxLength(45)
                .IsUnicode(false)
                .HasColumnName("LAYOUT_APP");
            //entity.Property(e => e.LayoutGenApp)
            //   .HasMaxLength(20)
            //   .IsUnicode(false)
            //   .HasColumnName("LAYOUT_GEN_APP");
            entity.Property(e => e.LayoutDrawnBy)
                .HasMaxLength(45)
                .IsUnicode(false)
                .HasColumnName("LAYOUT_DRAWN_BY");
            entity.Property(e => e.LayoutDrawnDate)
                .HasColumnType("DATE")
                .HasColumnName("LAYOUT_DRAWN_DATE");
            entity.Property(e => e.LayoutSeqnum)
                .HasPrecision(8)
                .HasColumnName("LAYOUT_SEQNUM");
            entity.Property(e => e.LayoutType)
                .HasMaxLength(2)
                .IsUnicode(false)
                .HasColumnName("LAYOUT_TYPE");
            entity.Property(e => e.LayoutnumCreatedBy)
                .HasMaxLength(45)
                .IsUnicode(false)
                .HasColumnName("LAYOUTNUM_CREATED_BY");
            entity.Property(e => e.LayoutnumCreatedDate)
                .HasColumnType("DATE")
                .HasColumnName("LAYOUTNUM_CREATED_DATE");
            entity.Property(e => e.NetworkId)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("NETWORK_ID");
            entity.Property(e => e.Status)
                .HasMaxLength(32)
                .IsUnicode(false)
                .HasColumnName("STATUS");
            entity.Property(e => e.WrNum)
                .HasMaxLength(600)
                .IsUnicode(false)
                .HasColumnName("WR_NUM");
        });

        modelBuilder.Entity<Municipal>(entity =>
        {
            entity
                .HasNoKey()
                .ToTable("MUNICIPALS");

            entity.Property(e => e.Division)
                .HasMaxLength(2)
                .IsUnicode(false)
                .HasColumnName("DIVISION");
            entity.Property(e => e.MuniCode)
                .HasPrecision(3)
                .HasColumnName("MUNI_CODE");
            entity.Property(e => e.MuniName)
                .HasMaxLength(40)
                .IsUnicode(false)
                .HasColumnName("MUNI_NAME");
            entity.Property(e => e.Municipality)
                .HasMaxLength(3)
                .IsUnicode(false)
                .HasColumnName("MUNICIPALITY");
        });

        modelBuilder.Entity<NetworkName>(entity =>
        {
            entity
                .HasNoKey()
                .ToTable("NETWORK_NAME");

            entity.Property(e => e.Division)
                .HasMaxLength(4)
                .IsUnicode(false)
                .HasColumnName("DIVISION");
            entity.Property(e => e.NetworkName1)
                .HasMaxLength(64)
                .IsUnicode(false)
                .HasColumnName("NETWORK_NAME");
            entity.Property(e => e.NetworkNo)
                .HasMaxLength(64)
                .IsUnicode(false)
                .HasColumnName("NETWORK_NO");
            entity.Property(e => e.RmsBoro)
                .HasMaxLength(4)
                .IsUnicode(false)
                .HasColumnName("RMS_BORO");
            entity.Property(e => e.RmsNetworkCode)
                .HasMaxLength(4)
                .IsUnicode(false)
                .HasColumnName("RMS_NETWORK_CODE");
        });
        modelBuilder.HasSequence("DCSRVMSLINK");

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
