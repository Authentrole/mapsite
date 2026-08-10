using MapsAPI.Entities.eGIS;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;

namespace MapsAPI.Contexts;

public partial class EgisDBContext : DbContext
{
    public EgisDBContext()
    {
    }

    public EgisDBContext(DbContextOptions<EgisDBContext> options)
        : base(options)
    {
    }

    public virtual DbSet<EgisAppUsersVw> EgisAppUsersVws { get; set; }
    public virtual DbSet<EgisRegion> EgisRegions { get; set; }
    public virtual DbSet<EgisUserDetail> EgisUserDetails { get; set; }
    public virtual DbSet<UamUsersEdw> UamUsersEdws { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    { 
        if (!optionsBuilder.IsConfigured)
        {
    //        #warning To protect potentially sensitive information in your connection string, you should move it out of source code. You can avoid scaffolding the connection string by using the Name= syntax to read it from configuration - see https://go.microsoft.com/fwlink/?linkid=2131148. For more guidance on storing connection strings, see https://go.microsoft.com/fwlink/?LinkId=723263.
    //=> optionsBuilder.UseOracle("Data Source=(DESCRIPTION = (ADDRESS = (PROTOCOL = TCP)(HOST = gdbegisd-scan.conedison.net)(PORT = 1521)) (CONNECT_DATA = (SERVER = DEDICATED) (SERVICE_NAME = GUAMDEV)));User Id=egis_admin; Password=egis_admin");

        }
    }
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder
            .HasDefaultSchema(GlobalVars.eGIS_Schema_Name)
            .UseCollation("USING_NLS_COMP");

        modelBuilder.Entity<EgisAppUsersVw>(entity =>
        {
            entity.HasNoKey();

            entity.ToView("EGIS_APP_USERS_VW");

            entity.Property(e => e.Appid)
                .HasColumnType("NUMBER")
                //.ValueGeneratedOnAdd()
                .HasColumnName("APPID");

            entity.Property(e => e.Appname)
                .HasMaxLength(30)
                .IsUnicode(false)
                .HasColumnName("APPNAME");

            entity.Property(e => e.CreatedBy)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasColumnName("CREATED_BY");

            entity.Property(e => e.CreatedDate)
                .HasColumnType("DATE")
                .HasColumnName("CREATED_DATE");

            entity.Property(e => e.Envid)
                .HasColumnType("NUMBER")
                //.ValueGeneratedOnAdd()
                .HasColumnName("ENVID");

            entity.Property(e => e.Environment)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasColumnName("ENVIRONMENT");

            entity.Property(e => e.Roleid)
                .HasColumnType("NUMBER")
                //.ValueGeneratedOnAdd()
                .HasColumnName("ROLEID");

            entity.Property(e => e.Rolename)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("ROLENAME");

            entity.Property(e => e.Username)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasColumnName("USERNAME");
        });

        modelBuilder.Entity<EgisRegion>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("EGIS_REGIONS_PK");

            entity.ToTable("EGIS_REGIONS");

            entity.Property(e => e.Id)
                .HasColumnType("NUMBER")
                .HasColumnName("ID");
            entity.Property(e => e.Alias)
                .HasMaxLength(2)
                .IsUnicode(false)
                .HasColumnName("ALIAS");
            entity.Property(e => e.Borough)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasColumnName("BOROUGH");
            entity.Property(e => e.Region)
                .HasMaxLength(2)
                .IsUnicode(false)
                .HasColumnName("REGION");
            entity.Property(e => e.ShortName)
                .HasMaxLength(2)
                .IsUnicode(false)
                .HasColumnName("SHORT_NAME");
        });

        modelBuilder.Entity<EgisUserDetail>(entity =>
        {
            entity.ToTable("EGIS_USER_DETAILS");

            entity.HasIndex(e => e.Username, "EGIS_USER_DETAILS_UK1")
                .IsUnique();

            entity.Property(e => e.Id)
                .HasColumnType("NUMBER")
                .ValueGeneratedOnAdd()
                .HasColumnName("ID");

            entity.Property(e => e.Adgroup)
                .HasMaxLength(100)
                .IsUnicode(false)
                .HasColumnName("ADGROUP");

            entity.Property(e => e.Department)
                .HasMaxLength(100)
                .IsUnicode(false)
                .HasColumnName("DEPARTMENT");

            entity.Property(e => e.Email)
                .HasMaxLength(150)
                .IsUnicode(false)
                .HasColumnName("EMAIL");

            entity.Property(e => e.Emptype)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasColumnName("EMPTYPE");

            entity.Property(e => e.Fullname)
                .HasMaxLength(100)
                .IsUnicode(false)
                .HasColumnName("FULLNAME");

            entity.Property(e => e.Manager)
                .HasMaxLength(100)
                .IsUnicode(false)
                .HasColumnName("MANAGER");

            entity.Property(e => e.Username)
                .HasMaxLength(30)
                .IsUnicode(false)
                .HasColumnName("USERNAME");
        });


        modelBuilder.Entity<UamUsersEdw>(entity =>
        {
            entity
                .HasNoKey()
                .ToTable("UAM_USERS_EDW");

            entity.Property(e => e.ActionCd)
                .HasMaxLength(9)
                .IsUnicode(false)
                .HasColumnName("ACTION_CD");
            entity.Property(e => e.Active)
                .HasPrecision(5)
                .HasColumnName("ACTIVE");
            entity.Property(e => e.AdjHireDate)
                .HasColumnType("DATE")
                .HasColumnName("ADJ_HIRE_DATE");
            entity.Property(e => e.AliasName)
                .HasMaxLength(102)
                .IsUnicode(false)
                .HasColumnName("ALIAS_NAME");
            entity.Property(e => e.AssistantCompanyCd)
                .HasPrecision(10)
                .HasColumnName("ASSISTANT_COMPANY_CD");
            entity.Property(e => e.AssistantEmpNo)
                .HasPrecision(10)
                .HasColumnName("ASSISTANT_EMP_NO");
            entity.Property(e => e.Band)
                .HasMaxLength(9)
                .IsUnicode(false)
                .HasColumnName("BAND");
            entity.Property(e => e.BusinessUnitCd)
                .HasPrecision(5)
                .HasColumnName("BUSINESS_UNIT_CD");
            entity.Property(e => e.CardCode)
                .HasPrecision(10)
                .HasColumnName("CARD_CODE");
            entity.Property(e => e.CarpoolDriver)
                .HasMaxLength(3)
                .IsUnicode(false)
                .IsFixedLength()
                .HasColumnName("CARPOOL_DRIVER");
            entity.Property(e => e.CompanyCd)
                .HasPrecision(10)
                .HasColumnName("COMPANY_CD");
            entity.Property(e => e.DeptCd)
                .HasPrecision(5)
                .HasColumnName("DEPT_CD");
            entity.Property(e => e.DeptId)
                .HasMaxLength(30)
                .IsUnicode(false)
                .HasColumnName("DEPT_ID");
            entity.Property(e => e.DeptLevelName)
                .HasMaxLength(150)
                .IsUnicode(false)
                .HasColumnName("Dept_Level Name");
            entity.Property(e => e.DeptName)
                .HasMaxLength(360)
                .IsUnicode(false)
                .HasColumnName("Dept_Name");
            entity.Property(e => e.DeptTitle)
                .HasMaxLength(150)
                .IsUnicode(false)
                .HasColumnName("Dept_Title");
            entity.Property(e => e.DirectDepInd)
                .HasMaxLength(3)
                .IsUnicode(false)
                .IsFixedLength()
                .HasColumnName("DIRECT_DEP_IND");
            entity.Property(e => e.DischargeDate)
                .HasColumnType("DATE")
                .HasColumnName("DISCHARGE_DATE");
            entity.Property(e => e.EmailAddressCompany)
                .HasMaxLength(210)
                .IsUnicode(false)
                .HasColumnName("EMAIL_ADDRESS_COMPANY");
            entity.Property(e => e.EmpNo)
                .HasPrecision(10)
                .HasColumnName("EMP_NO");
            entity.Property(e => e.EnterpriseCd)
                .HasPrecision(5)
                .HasColumnName("ENTERPRISE_CD");
            entity.Property(e => e.ExpectedReturnDate)
                .HasColumnType("DATE")
                .HasColumnName("EXPECTED_RETURN_DATE");
            entity.Property(e => e.FirstName)
                .HasMaxLength(150)
                .IsUnicode(false)
                .HasColumnName("FIRST_NAME");
            entity.Property(e => e.FtPtCd)
                .HasMaxLength(6)
                .IsUnicode(false)
                .IsFixedLength()
                .HasColumnName("FT_PT_CD");
            entity.Property(e => e.HireDate)
                .HasColumnType("DATE")
                .HasColumnName("HIRE_DATE");
            entity.Property(e => e.HomeCity)
                .HasMaxLength(150)
                .IsUnicode(false)
                .HasColumnName("HOME_CITY");
            entity.Property(e => e.HomeState)
                .HasMaxLength(18)
                .IsUnicode(false)
                .HasColumnName("HOME_STATE");
            entity.Property(e => e.HomeZip)
                .HasMaxLength(36)
                .IsUnicode(false)
                .HasColumnName("HOME_ZIP");
            entity.Property(e => e.InOcdbDate)
                .HasColumnType("DATE")
                .HasColumnName("IN_OCDB_DATE");
            entity.Property(e => e.InTitleDate)
                .HasColumnType("DATE")
                .HasColumnName("IN_TITLE_DATE");
            entity.Property(e => e.Isofficer)
                .HasMaxLength(3)
                .IsUnicode(false)
                .IsFixedLength()
                .HasColumnName("ISOFFICER");
            entity.Property(e => e.JobRateCd)
                .HasMaxLength(18)
                .IsUnicode(false)
                .HasColumnName("JOB_RATE_CD");
            entity.Property(e => e.JobStatusCd)
                .HasMaxLength(3)
                .IsUnicode(false)
                .IsFixedLength()
                .HasColumnName("JOB_STATUS_CD");
            entity.Property(e => e.JobSuffix)
                .HasMaxLength(12)
                .IsUnicode(false)
                .IsFixedLength()
                .HasColumnName("JOB_SUFFIX");
            entity.Property(e => e.JobTitle)
                .HasMaxLength(150)
                .IsUnicode(false)
                .HasColumnName("Job Title");
            entity.Property(e => e.LastActionDate)
                .HasColumnType("DATE")
                .HasColumnName("LAST_ACTION_DATE");
            entity.Property(e => e.LastDateWorked)
                .HasColumnType("DATE")
                .HasColumnName("LAST_DATE_WORKED");
            entity.Property(e => e.LastName)
                .HasMaxLength(150)
                .IsUnicode(false)
                .HasColumnName("LAST_NAME");
            entity.Property(e => e.LastUpdated)
                .HasColumnType("DATE")
                .HasColumnName("LAST_UPDATED");
            entity.Property(e => e.LastUpdatedBy)
                .HasPrecision(10)
                .HasColumnName("LAST_UPDATED_BY");
            entity.Property(e => e.LastUpdatedByCompany)
                .HasPrecision(10)
                .HasColumnName("LAST_UPDATED_BY_COMPANY");
            entity.Property(e => e.LastUpdatedSystem)
                .HasPrecision(10)
                .HasColumnName("LAST_UPDATED_SYSTEM");
            entity.Property(e => e.ManagerCd)
                .HasMaxLength(15)
                .IsUnicode(false)
                .HasColumnName("MANAGER_CD");
            entity.Property(e => e.ManagerCdCompany)
                .HasPrecision(10)
                .HasColumnName("MANAGER_CD_COMPANY");
            entity.Property(e => e.MiddleInitial)
                .HasMaxLength(3)
                .IsUnicode(false)
                .IsFixedLength()
                .HasColumnName("MIDDLE_INITIAL");
            entity.Property(e => e.NamePrefix)
                .HasMaxLength(30)
                .IsUnicode(false)
                .HasColumnName("NAME_PREFIX");
            entity.Property(e => e.NameSuffix)
                .HasMaxLength(45)
                .IsUnicode(false)
                .HasColumnName("NAME_SUFFIX");
            entity.Property(e => e.Nickname)
                .HasMaxLength(150)
                .IsUnicode(false)
                .HasColumnName("NICKNAME");
            entity.Property(e => e.OrgCd)
                .HasPrecision(5)
                .HasColumnName("ORG_CD");
            entity.Property(e => e.OrgLevelName)
                .HasMaxLength(150)
                .IsUnicode(false)
                .HasColumnName("Org_Level Name");
            entity.Property(e => e.OrgName)
                .HasMaxLength(360)
                .IsUnicode(false)
                .HasColumnName("Org_Name");
            entity.Property(e => e.OrgTitle)
                .HasMaxLength(150)
                .IsUnicode(false)
                .HasColumnName("Org_Title");
            entity.Property(e => e.PayLocation)
                .HasPrecision(10)
                .HasColumnName("PAY_LOCATION");
            entity.Property(e => e.PersonSubtype)
                .HasMaxLength(6)
                .IsUnicode(false)
                .IsFixedLength()
                .HasColumnName("PERSON_SUBTYPE");
            entity.Property(e => e.PrimaryWindowsNtAccount)
                .HasMaxLength(120)
                .IsUnicode(false)
                .HasColumnName("PRIMARY_WINDOWS_NT_ACCOUNT");
            entity.Property(e => e.ProbationDate)
                .HasColumnType("DATE")
                .HasColumnName("PROBATION_DATE");
            entity.Property(e => e.ProxyAddressesSecondary)
                .HasPrecision(10)
                .HasColumnName("PROXY_ADDRESSES_SECONDARY");
            entity.Property(e => e.ReHireDate)
                .HasColumnType("DATE")
                .HasColumnName("RE_HIRE_DATE");
            entity.Property(e => e.RegularTemporary)
                .HasMaxLength(3)
                .IsUnicode(false)
                .IsFixedLength()
                .HasColumnName("REGULAR_TEMPORARY");
            entity.Property(e => e.ReviewDate)
                .HasColumnType("DATE")
                .HasColumnName("REVIEW_DATE");
            entity.Property(e => e.ReviewerCompanyCd)
                .HasPrecision(10)
                .HasColumnName("REVIEWER_COMPANY_CD");
            entity.Property(e => e.ReviewerEmpNo)
                .HasPrecision(10)
                .HasColumnName("REVIEWER_EMP_NO");
            entity.Property(e => e.SectCd)
                .HasPrecision(5)
                .HasColumnName("SECT_CD");
            entity.Property(e => e.SectLevelName)
                .HasMaxLength(150)
                .IsUnicode(false)
                .HasColumnName("Sect_Level Name");
            entity.Property(e => e.SectName)
                .HasMaxLength(360)
                .IsUnicode(false)
                .HasColumnName("Sect_Name");
            entity.Property(e => e.SectTitle)
                .HasMaxLength(150)
                .IsUnicode(false)
                .HasColumnName("Sect_Title");
            entity.Property(e => e.SpocAddlReports)
                .HasPrecision(10)
                .HasColumnName("SPOC_ADDL_REPORTS");
            entity.Property(e => e.SpocCheckData)
                .HasPrecision(10)
                .HasColumnName("SPOC_CHECK_DATA");
            entity.Property(e => e.SpocLastUpdated)
                .HasPrecision(10)
                .HasColumnName("SPOC_LAST_UPDATED");
            entity.Property(e => e.SpocLastUpdatedBy)
                .HasPrecision(10)
                .HasColumnName("SPOC_LAST_UPDATED_BY");
            entity.Property(e => e.SpocLastUpdatedByCompany)
                .HasPrecision(10)
                .HasColumnName("SPOC_LAST_UPDATED_BY_COMPANY");
            entity.Property(e => e.SpocLastUpdatedSystem)
                .HasPrecision(10)
                .HasColumnName("SPOC_LAST_UPDATED_SYSTEM");
            entity.Property(e => e.StandardHours)
                .HasColumnType("NUMBER(18,4)")
                .HasColumnName("STANDARD_HOURS");
            entity.Property(e => e.SupervisorCompanyCd)
                .HasPrecision(10)
                .HasColumnName("SUPERVISOR_COMPANY_CD");
            entity.Property(e => e.SupervisorEmpNo)
                .HasPrecision(10)
                .HasColumnName("SUPERVISOR_EMP_NO");
            entity.Property(e => e.SystemStatus)
                .HasMaxLength(3)
                .IsUnicode(false)
                .IsFixedLength()
                .HasColumnName("SYSTEM_STATUS");
            entity.Property(e => e.TdesMpareApproverCompanyCd)
                .HasPrecision(10)
                .HasColumnName("TDES_MPARE_APPROVER_COMPANY_CD");
            entity.Property(e => e.TdesMpareApproverEmpNo)
                .HasPrecision(10)
                .HasColumnName("TDES_MPARE_APPROVER_EMP_NO");
            entity.Property(e => e.TelephoneAssistant)
                .HasMaxLength(72)
                .IsUnicode(false)
                .HasColumnName("TELEPHONE_ASSISTANT");
            entity.Property(e => e.TelephoneCellCompany)
                .HasMaxLength(72)
                .IsUnicode(false)
                .HasColumnName("TELEPHONE_CELL_COMPANY");
            entity.Property(e => e.TelephoneCellOther)
                .HasPrecision(10)
                .HasColumnName("TELEPHONE_CELL_OTHER");
            entity.Property(e => e.TelephoneCerc1)
                .HasPrecision(10)
                .HasColumnName("TELEPHONE_CERC1");
            entity.Property(e => e.TelephoneCerc2)
                .HasPrecision(10)
                .HasColumnName("TELEPHONE_CERC2");
            entity.Property(e => e.TelephoneCercFax)
                .HasPrecision(10)
                .HasColumnName("TELEPHONE_CERC_FAX");
            entity.Property(e => e.TelephoneHome)
                .HasMaxLength(72)
                .IsUnicode(false)
                .HasColumnName("TELEPHONE_HOME");
            entity.Property(e => e.TelephoneHome2)
                .HasMaxLength(72)
                .IsUnicode(false)
                .HasColumnName("TELEPHONE_HOME2");
            entity.Property(e => e.TelephoneHome3)
                .HasPrecision(10)
                .HasColumnName("TELEPHONE_HOME3");
            entity.Property(e => e.TelephoneHome4)
                .HasPrecision(10)
                .HasColumnName("TELEPHONE_HOME4");
            entity.Property(e => e.TelephoneHomeFax)
                .HasPrecision(10)
                .HasColumnName("TELEPHONE_HOME_FAX");
            entity.Property(e => e.TelephoneHomeFax2)
                .HasPrecision(10)
                .HasColumnName("TELEPHONE_HOME_FAX2");
            entity.Property(e => e.TelephoneMobileCompany)
                .HasPrecision(10)
                .HasColumnName("TELEPHONE_MOBILE_COMPANY");
            entity.Property(e => e.TelephoneOffice1)
                .HasMaxLength(72)
                .IsUnicode(false)
                .HasColumnName("TELEPHONE_OFFICE1");
            entity.Property(e => e.TelephoneOffice2)
                .HasMaxLength(72)
                .IsUnicode(false)
                .HasColumnName("TELEPHONE_OFFICE2");
            entity.Property(e => e.TelephoneOfficeFax)
                .HasMaxLength(72)
                .IsUnicode(false)
                .HasColumnName("TELEPHONE_OFFICE_FAX");
            entity.Property(e => e.TelephonePagerCompany)
                .HasMaxLength(300)
                .IsUnicode(false)
                .HasColumnName("TELEPHONE_PAGER_COMPANY");
            entity.Property(e => e.TelephoneRadioNextel)
                .HasMaxLength(300)
                .IsUnicode(false)
                .HasColumnName("TELEPHONE_RADIO_NEXTEL");
            entity.Property(e => e.TempPayLocation)
                .HasPrecision(10)
                .HasColumnName("TEMP_PAY_LOCATION");
            entity.Property(e => e.UnionCd)
                .HasMaxLength(9)
                .IsUnicode(false)
                .HasColumnName("UNION_CD");
            entity.Property(e => e.UnionMngtCd)
                .HasMaxLength(3)
                .IsUnicode(false)
                .IsFixedLength()
                .HasColumnName("UNION_MNGT_CD");
            entity.Property(e => e.VpCd)
                .HasPrecision(5)
                .HasColumnName("VP_CD");
            entity.Property(e => e.VpLevelName)
                .HasMaxLength(150)
                .IsUnicode(false)
                .HasColumnName("VP_Level Name");
            entity.Property(e => e.VpName)
                .HasMaxLength(360)
                .IsUnicode(false)
                .HasColumnName("VP_Name");
            entity.Property(e => e.VpTitle)
                .HasMaxLength(150)
                .IsUnicode(false)
                .HasColumnName("VP_Title");
            entity.Property(e => e.WorkAddress)
                .HasMaxLength(150)
                .IsUnicode(false)
                .HasColumnName("Work Address");
            entity.Property(e => e.WorkCity)
                .HasMaxLength(150)
                .IsUnicode(false)
                .HasColumnName("Work City");
            entity.Property(e => e.WorkMdsLocation)
                .HasMaxLength(30)
                .IsUnicode(false)
                .HasColumnName("WORK_MDS_LOCATION");
            entity.Property(e => e.WorkRoom)
                .HasMaxLength(150)
                .IsUnicode(false)
                .HasColumnName("WORK_ROOM");
            entity.Property(e => e.WorkStatus)
                .HasMaxLength(6)
                .IsUnicode(false)
                .IsFixedLength()
                .HasColumnName("WORK_STATUS");
            entity.Property(e => e.YrsOfService)
                .HasPrecision(5)
                .HasColumnName("YRS_OF_SERVICE");
        });


        modelBuilder.HasSequence("APPLICATION_CONTACTS_SEQ");
        modelBuilder.HasSequence("EGIS_APP_USAGE_SEQ");
        modelBuilder.HasSequence("EGIS_ARCFMWEB_LOG_SEQ");
        modelBuilder.HasSequence("EGIS_CTITRIX_DELIVERY_GROUP_SEQ");
        modelBuilder.HasSequence("EGIS_FEEDER_ATTACHMENTS_SEQ");
        modelBuilder.HasSequence("EGIS_FEEDER_DEFECT_DETAILS_SEQ");
        modelBuilder.HasSequence("EGIS_FEEDER_DEFECTS_HISTORY_SEQ");
        modelBuilder.HasSequence("EGIS_FEEDER_DEFECTS_SEQ");
        modelBuilder.HasSequence("EGIS_FEEDER_FEEDBACK_SEQ");
        modelBuilder.HasSequence("EGIS_FEEDER_HISTORY_SEQ");
        modelBuilder.HasSequence("EGIS_FEEDER_REVIEWERS_SEQ");
        modelBuilder.HasSequence("EGIS_FEEDER_SEQ");
        modelBuilder.HasSequence("EGIS_FEEDER_STATUS_SEQ");
        modelBuilder.HasSequence("EGIS_FILE_STORE_SEQ");
        modelBuilder.HasSequence("EGIS_FILE_STORE_SEQ1");
        modelBuilder.HasSequence("EGIS_SITECONFIG_SEQ");
        modelBuilder.HasSequence("EGIS_SITECONFIG_SEQ1");
        modelBuilder.HasSequence("EGIS_SITECONFIG_SEQ2");
        modelBuilder.HasSequence("EGIS_TEAMS_DL_SEQ");
        modelBuilder.HasSequence("EGIS_USER_DETAILS_SEQ");
        modelBuilder.HasSequence("EGIS_WEB_VIEWER_ENVIRONMENT_SEQ");
        modelBuilder.HasSequence("EGISINV_DATACENTER_SEQ");
        modelBuilder.HasSequence("EGISINV_MACHINE_CERTS_SEQ");
        modelBuilder.HasSequence("EGISINV_MACHINE_PROJECT_ENV_SEQ");
        modelBuilder.HasSequence("EGISINV_MACHINE_ROLES_SEQ");
        modelBuilder.HasSequence("EGISINV_MACHINE_SOFTWARE_SEQ");
        modelBuilder.HasSequence("EGISINV_MACHINE_SOFTWARES_SEQ");
        modelBuilder.HasSequence("EGISINV_MACHINE_TIERS_SEQ");
        modelBuilder.HasSequence("EGISINV_MACHINES_LOGS_SEQ");
        modelBuilder.HasSequence("EGISINV_MACHINES_SEQ");
        modelBuilder.HasSequence("EGISINV_OS_SEQ");
        modelBuilder.HasSequence("EGISINV_SSLCERTS_SEQ");
        modelBuilder.HasSequence("EGISINV_STORAGES_SEQ");
        modelBuilder.HasSequence("STAKEHOLDERS_SEQ");
        modelBuilder.HasSequence("UAM_OTHER_RESOURCES_SEQ");
        modelBuilder.HasSequence("UAM_RESOURCE_SECURITY_GROUPS_SEQ");
        modelBuilder.HasSequence("UAM_USERS_SEQ");

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
