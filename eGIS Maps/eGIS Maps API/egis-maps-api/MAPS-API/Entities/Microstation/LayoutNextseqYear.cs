using System;
using System.Collections.Generic;

namespace MapsAPI.Entities.Microstation;

public partial class LayoutNextseqYear
{
    public string Division { get; set; }

    public string LayoutClass { get; set; }

    public int LayoutYear { get; set; }

    public int CurrentSeq { get; set; }

    public DateTime? LastUsedDate { get; set; }

    public string LastUser { get; set; }
}
