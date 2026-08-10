
import { HttpEvent, HttpHandler, HttpHeaders, HttpInterceptor, HttpRequest } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

@Injectable()
export class HttpCoreInterceptor implements HttpInterceptor { 
    
    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
        //let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': 'true','Access-Control-Allow-Headers':'*' });
        if(request.method.toLowerCase() == 'post'){
            request = request.clone({
                headers:headers,
                withCredentials: true
            }); 
        }
        else{
            request = request.clone({
                withCredentials: true
            }); 
        }
        

    //     let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': 'true','Access-Control-Allow-Headers':'*' });
    //    if(request.method.toLowerCase()=="get"){
    //     request = request.clone({
    //         //headers:headers,
    //         withCredentials: true
    //     }); 
    //    }
    //    else{
    //     let headers = new HttpHeaders({ "Content-Type": "x-custom-header"});
    //     request = request.clone({
    //         headers:headers,
    //         //withCredentials: true
    //     }); 
    //    }
               
        
    
        return next.handle(request);
    }
}