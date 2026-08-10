using System;
using System.Collections.Generic;

namespace MapsAPI.Entities.Microstation;

public partial class LayoutnumLog
{
    public string Division { get; set; }

    public string LayoutClass { get; set; }

    public string LayoutNum { get; set; }

    public int LayoutSeqnum { get; set; }

    public string LayoutType { get; set; }

    public DateTime? LayoutnumCreatedDate { get; set; }

    public string LayoutnumCreatedBy { get; set; }

    public DateTime? LayoutDrawnDate { get; set; }

    public string LayoutDrawnBy { get; set; }

    public string LayoutApp { get; set; }
    //public string LayoutGenApp { get; set; }

    public string EventNum { get; set; }
    public string McNum { get; set; }
    public string SectionNum { get; set; }
    public string WrNum { get; set; }

    public string NetworkId { get; set; }

    public string Status { get; set; }
}
