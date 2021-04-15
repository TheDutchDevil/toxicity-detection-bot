import * as core from "@actions/core"

import axios from "axios"

export class SurveyApi {
    public  static async getSurveyUrl(slug : String, issueNumber : number) : Promise<string> {
        
        const logKey = core.getInput("LOG_KEY");


        try {
            let res = await axios.put("https://toxic.research.cassee.dev/surveys/toxicity", {}, { params: { key: logKey, slug: slug, issue_number: issueNumber}} );

            return res.data.url;
        } catch(err) {
            if(err.name === "Error") {
                core.info(JSON.stringify(err))
                core.setFailed("Could not create survey")
                throw new Error("Could not create survey");
            } else {
                core.error(JSON.stringify(err));
                core.setFailed("Could not reach survey")
                throw new Error("Could not reach survey endpoint");
            }
        }
    }
}