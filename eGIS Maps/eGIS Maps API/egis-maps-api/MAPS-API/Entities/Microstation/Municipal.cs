using System;
using System.Collections.Generic;

namespace MapsAPI.Entities.Microstation;

public partial class Municipal
{
    public string Municipality { get; set; }

    public string MuniName { get; set; }

    public byte? MuniCode { get; set; }

    public string Division { get; set; }
}
