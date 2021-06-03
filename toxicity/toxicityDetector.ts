import * as tf from  "@tensorflow/tfjs" 
import * as toxicity from "@tensorflow-models/toxicity"
import * as core from "@actions/core"
import { LogTypes, ToxicityCommand } from "../eventProcessor";
import { EventLogger } from "../toxicApi/Logger";
import Rand, {PRNG} from 'rand-seed';
import { ApiWrapper } from "../github/ApiWrapper";
import { SurveyApi } from "../toxicApi/Survey";


export class ToxicityDetector {
    private setupDone : boolean;

    /**
     * The threshold used to determine whether the 
     * output of the toxicity model should be marked as toxic.
     */
    private threshold : number;

    private apiWrapper: ApiWrapper;
    
    constructor(threshold : number) {
        this.setupDone = false;
        this.threshold = threshold;

        this.apiWrapper = new ApiWrapper();

        core.info(`Set up toxicity detector with a threshold of ${threshold}`);
    }

    private async setUp() : Promise<void> {
        await tf.setBackend("cpu");
        this.setupDone = true;
    }

    public async processCommand(command : ToxicityCommand) : Promise<void> {
        if(!this.setupDone) {
            await this.setUp();
        }

        const model = await toxicity.load(this.threshold, ["identity_attack", "insult", "severe_toxicity", "threat", "toxicity"]);

        const prediction = await model.classify([command.text]);

        let isToxic = false;

        isToxic = prediction.some(item => item.results[0].match);

        command.isToxic = isToxic;
        command.predictions = prediction;

        if(isToxic) {
            /**
             * We initialize a RNG using the hash of the slug and the issue number. 
             * Based on the first value generated by the RNG we determine wheter we should 
             * intervene. 
             */
            const rand = new Rand(String(hashCode(`${command.slug}-${command.issueNumber}`)));

            let silentString = core.getInput("SILENT");

            let isSilent = silentString.toLowerCase() === "true";            

            var surveyUrl = await SurveyApi.getSurveyUrl(command.slug, command.issueNumber);                

            command.toxicitySurveyUrl = surveyUrl;

            if(!isSilent && rand.next() > .5) {
                command.shouldIntervene = true; 

                let message = core.getInput("MESSAGE");

                if (message === "") {
                    message = "Do not be toxic!";
                }

                message += `

-----------------------------

This bot is a part of a research study, please help us out by responding to the survey here: ${surveyUrl}`;

                core.info("Using GH API to post a comment");

                if(command.location === LogTypes.COMMENT || command.location === LogTypes.REVIEW || command.location === LogTypes.ISSUE || command.location === LogTypes.PULL_REQUEST) {
                    this.apiWrapper.postCommentToIssue(command.getProjectOwner(), command.getProjectName(), command.issueNumber, message); 
                } else if(command.location === LogTypes.REVIEW_COMMENT) {
                    this.apiWrapper.postCommentToReviewComment(command.getProjectOwner(), command.getProjectName(), command.issueNumber, command.context.payload.comment.id, message); 
                }
            }
        }

        return;
    }
}

/**
 * Returns a hash code for a string.
 * (Compatible to Java's String.hashCode())
 *
 * The hash code for a string object is computed as
 *     s[0]*31^(n-1) + s[1]*31^(n-2) + ... + s[n-1]
 * using number arithmetic, where s[i] is the i th character
 * of the given string, n is the length of the string,
 * and ^ indicates exponentiation.
 * (The hash value of the empty string is zero.)
 *
 * @param {string} s a string
 * @return {number} a hash code value for the given string.
 */
function hashCode(s) {
    for(var i = 0, h = 0; i < s.length; i++)
        h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    return h;
}