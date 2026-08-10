using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace MapsAPI
{
    public class GlobalVars
    {
        public static string egis_db { get; set; }
        public static string uft_db { get; set; }
        public static string maps_db { get; set; }
        public static string microstation_db { get; set; }
        public static string environment { get; set; }
        public static string serverName { get; set; }
        public static string OPS_AD_Groups { get; set; }
        public static string Non_Ops_AD_Grooups { get; set; }
        public static string App_AD_Group { get; set; }        
        public static bool Consider_AD_Group { get; set; }
        public static string appName { get; set; }
        public static string PDF_File_Path { get; set; }
        public static string Maps_Schema_Name { get; set; }
        public static string eGIS_Schema_Name { get; set; }
        public static string UFT_Schema_Name { get; set; }
        public static string Microstation_Schema_Name { get; set; }
        public static string Default_Page_Size { get; set; }
        public static string secret_key { get; set; }
    }
}
