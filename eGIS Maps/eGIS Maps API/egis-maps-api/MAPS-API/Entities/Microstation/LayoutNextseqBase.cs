using System;
using System.Collections.Generic;

namespace MapsAPI.Entities.Microstation;

public partial class LayoutNextseqBase
{
    public string Division { get; set; }

    public string LayoutClass { get; set; }

    public int InitSeq { get; set; }

    public DateTime? LastUpdateDate { get; set; }
}
