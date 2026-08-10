using System;
using System.Collections.Generic;

namespace MapsAPI.Entities.eGIS;

public partial class EgisRegion
{
    public decimal Id { get; set; }

    public string Region { get; set; }

    public string Borough { get; set; }

    public string Alias { get; set; }

    public string ShortName { get; set; }
}
