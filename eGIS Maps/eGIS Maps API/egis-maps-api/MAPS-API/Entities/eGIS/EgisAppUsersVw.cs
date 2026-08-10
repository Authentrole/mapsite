using System;
using System.Collections.Generic;

#nullable disable

namespace MapsAPI.Entities.eGIS
{
    public partial class EgisAppUsersVw
    {
        public string Username { get; set; }
        public string Appname { get; set; }
        public decimal? Appid { get; set; }
        public string Rolename { get; set; }
        public decimal? Roleid { get; set; }
        public DateTime? CreatedDate { get; set; }
        public string CreatedBy { get; set; }
        public string Environment { get; set; }
        public decimal? Envid { get; set; }
    }
}
