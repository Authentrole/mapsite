using System;

namespace MapsAPI.Models
{
    public class LayoutPayload
    {
        public int Year { get; set; }
        public string Division { get; set; }
        public string Municipal { get; set; }
        public string LayoutClass { get; set; }
        public string LayoutType { get; set; }
        public string LayoutNum { get; set; }
        public int Sequence { get; set; }         
        public string Part { get; set; }
        public string Network { get; set; }       
        public string EventNumber { get; set; }
        public string WrNumber { get; set; }
        public string McNumber { get; set; }
        public string SectionNumber { get; set; }
        public DateTime? CreatedDate { get; set; }
        public string CreatedBy { get; set; }
        public int PartCount { get; set; }
        public string LayoutApp { get; set; }
    }
}
