/**
 * Given a GH event this class
 * determines what action should be taken. 
 * 
 * For a new comment, or edited comment, the 
 * toxicity detection should be run. Meanwhile,
 * for a lock or a deletion the action should
 * be logged.
 */

import { Context } from "@actions/github/lib/context";
import { copyRegisteredKernels } from "@tensorflow/tfjs-core";
import { EventLogger } from "./toxicApi/Logger";
import { ToxicityDetector } from "./toxicity/toxicityDetector";

import { getAppInsightsClient } from "./appInsights";

import * as core from "@actions/core"



const types = {
    ISSUE_COMMENT:"issueComment",
    PULL_REQUEST_COMMENT: "pullRequestComment"
}

export enum LogTypes {
    COMMENT = "Comment",
    ISSUE = "Issue",
    REVIEW = "Review",
    REVIEW_COMMENT = "Review Comment",
    PULL_REQUEST = "Pull Request"
}

export enum Triggers {
    CREATE = "Create",
    EDIT = "Edit",
    DELETE = "Delete",
    /** Used as a sort of catch-all for Issue and PR events */
    OTHER = "Other"
}


 export class Command {

     constructor(context : Context, type: string) {
         this.context = context;
         this.type = type;
     }

     public context : Context;
     public type : string;
 }

/**
 * Command used to encapsulate a GH action that should be 
 * checked for toxicity. 
 */
 export class ToxicityCommand extends Command {
     public text : string;
     public location: LogTypes;
     public trigger: Triggers;

     public slug: string;
     public issueNumber : number;

     public predictions : any;
     public isToxic : boolean;
     public shouldIntervene: boolean;
     public toxicitySurveyUrl : string;

     constructor(context : Context, location : LogTypes, trigger: Triggers,
                 slug: string, issueNumber: number, text : string = null) {
         super(context, "ToxicityCheck");

         if (text === null) {
            this.text = context.payload.comment.body;
         } else {
            this.text = text; 
         }
         this.location = location;
         this.trigger = trigger;

         this.slug = slug;
         this.issueNumber = issueNumber;
     }

     public getProjectOwner() {
         return this.slug.split("/")[0]
     }

     /**
      * getProjectName
      */
     public getProjectName() {
         return this.slug.split("/")[1]
     }
 }

 export class LoggingCommand extends Command {
    type : LogTypes;
    trigger : Triggers;

    constructor(context: Context, type: LogTypes, trigger: Triggers) {
        super(context, "Logging");
        this.type = type;
        this.trigger = trigger;
    }

 }

 export class EventProcessor {

     async processEvent(context : Context) : Promise<void> {

        let startTime = new Date();

        const command =  this.parseCommand(context);

        if(command === null) {
            core.error("Could not process event into a command");
            return;
        }

        if(command instanceof ToxicityCommand) {

            core.info(`Processing Toxicity Command of location: ${command.location} and trigger ${command.trigger}`);
            
            const detector = new ToxicityDetector(0.8);

            await detector.processCommand(<ToxicityCommand>command);
        } 

        /**
         * Log the event
         */
         EventLogger.getInstance().LogCommand(command);

         var actionName = command instanceof ToxicityCommand ? (<ToxicityCommand>command).location.toString() : (<LoggingCommand>command).trigger.toString();
         
         actionName = `${command.type} ${actionName}`;

         getAppInsightsClient().trackRequest({name: actionName, url:'test', duration: (new Date().getTime() - startTime.getTime())/ 1000, success: true, resultCode: 200})
     }

     private parseCommand(context: Context) : Command{
         let command: Command = null;

         const slug = `${context.repo.owner}/${context.repo.repo}`;

         /**
          * This works for both a PR discussion comment and an issue discussion comment.
          */
         if (context.eventName === "issue_comment") {

             const commentAction = context.payload.action;

             if (commentAction === "created" || commentAction === "edited") {
                 command = new ToxicityCommand(context, LogTypes.COMMENT, commentAction === "created" ? Triggers.CREATE : Triggers.EDIT,
                 slug, context.issue.number);
             } else if (commentAction === "deleted") {
                 command = new LoggingCommand(context, LogTypes.COMMENT, Triggers.DELETE);
             } 
        /**
         * The below is called for every inline review comment that is posted. 
         */
         } else if (context.eventName === "pull_request_review_comment") {
             const commentAction = context.payload.action;

             if (commentAction === "created" || commentAction === "edited") {
                command = new ToxicityCommand(context, LogTypes.REVIEW_COMMENT, commentAction === "created" ? Triggers.CREATE : Triggers.EDIT,
                slug, context.issue.number);
             } else if (commentAction === "deleted") {
                 command = new LoggingCommand(context, LogTypes.REVIEW_COMMENT, Triggers.DELETE);
             }
         } else if (context.eventName === "pull_request_review") {
             const commentAction = context.payload.action;

             if (commentAction === "submitted" && context.payload.review.body !== null) {
                 command = new ToxicityCommand(context, LogTypes.REVIEW, Triggers.CREATE, slug,
                 context.payload.pull_request.number, context.payload.review.body);
             }
             else if (commentAction === "edited" && Object.keys(context.payload.changes).length > 0) {
                 /**
                  * If there are no changes then the submitted trigger was already called
                  */
                 const text = context.payload.review.body;
                 
                 command = new ToxicityCommand(context, LogTypes.REVIEW, Triggers.EDIT,
                    slug, context.payload.pull_request.number, text);
             } else if (commentAction === "dismissed") {
                 command = new LoggingCommand(context, LogTypes.REVIEW, Triggers.DELETE);
             }
         } else if (context.eventName === "issues") {
            const action = context.payload.action;

            if(action === "opened") {
                command = new ToxicityCommand(context, LogTypes.ISSUE, Triggers.CREATE, slug, 
                    context.payload.issue.number, context.payload.issue.body);
            } else if(action === "edited") {
                command = new ToxicityCommand(context, LogTypes.ISSUE, Triggers.EDIT, slug, 
                    context.payload.issue.number, context.payload.issue.body);
            } else {
                command = new LoggingCommand(context, LogTypes.ISSUE, Triggers.OTHER);
            }
         } else if (context.eventName === "pull_request") {
             const action = context.payload.action;

             if(action === "opened") {
                 command = new ToxicityCommand(context, LogTypes.PULL_REQUEST, Triggers.CREATE,
                 slug, context.payload.pull_request.number, context.payload.pull_request.body)
             } else if(action === "edited") {
                 command = new ToxicityCommand(context, LogTypes.PULL_REQUEST, Triggers.OTHER, slug,
                 context.payload.pull_request.number, context.payload.pull_request.body)
             } else {
                 command = new LoggingCommand(context, LogTypes.PULL_REQUEST, Triggers.OTHER);
             }
         } else {
             core.error("Was not able to understand incoming event.");
         }

         return command;
     }
 }