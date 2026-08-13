import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { ZonaParkirPrismaService } from "src/zona-parkir-prisma/zona-parkir-prisma.service";


@Processor("zona-parkir")
export class ZonaParkirProcessor extends WorkerHost {
    constructor(
        private readonly prisma: ZonaParkirPrismaService,
    ){
        super();
    }

    async process(job: Job, token?: string): Promise<any> {
        switch(job.name){
            case "check-keaktifan" :
                
                break;
            case "save-answer" :
                
                break;
        }
    }
}
