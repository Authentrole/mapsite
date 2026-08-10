import { Component, OnInit } from '@angular/core';
import { HeaderComponent } from '../../core/components/header/header.component';
import { FooterComponent } from '../../core/components/footer/footer.component';
import { CardModule } from '@progress/kendo-angular-layout';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
    selector: 'app-info',
    standalone: true,
    templateUrl: './info.component.html',
    styleUrl: './info.component.scss',
    imports: [CommonModule,HeaderComponent, FooterComponent, CardModule]
})
export class InfoComponent implements OnInit {
    isUnauthAccess:boolean=false;
    
    constructor( private route: ActivatedRoute) {}

    ngOnInit(): void {   
        let param = this.route.snapshot.paramMap.get('isAuthError') ;
        this.isUnauthAccess = param ? param == 'true' ? true : false : true;
    //   this.route.params.subscribe((params:any) => {
    //     this.isUnauthAccess = JSON.parse(params.queryParams["isAuthError"]);
    //   });
    }
}
