using System;
using System.Collections.Generic;

namespace MapsAPI.Entities.Microstation;

public partial class LayoutType
{
    public string LayoutType1 { get; set; }

    public string LayoutTypeDescription { get; set; }

    public string Status { get; set; }

    public DateTime? UpdateDate { get; set; }

    public string UserId { get; set; }
}
