using System;
using System.Collections.Generic;

#nullable disable

namespace MapsAPI.Entities.eGIS
{
    public partial class EgisAppUsage
    {
        public string AppName { get; set; }
        public string UserName { get; set; }
        public DateTime? ConnectedDate { get; set; }
        public string MachineName { get; set; }
        public string Environment { get; set; }
        public string Page { get; set; }
        public decimal Id { get; set; }
    }
}
