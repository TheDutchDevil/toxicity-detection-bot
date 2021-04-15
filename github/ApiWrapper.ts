import { getInput } from "@actions/core";
import { Octokit } from "@octokit/rest";
import { copyRegisteredKernels } from "@tensorflow/tfjs";

/**
 * Wrapper class around an octokit instance that
 * can be used to make comments. 
 */
export class ApiWrapper {

    private octoKit: Octokit;

    constructor() {
        const token = getInput("GITHUB_TOKEN");

        this.octoKit = new Octokit({auth: token});
    }

    public async postCommentToIssue(projectOwner: string, projectName: string, number: number, comment: string) : Promise<void> {
        await this.octoKit.issues.createComment({owner: projectOwner, repo: projectName, issue_number: number, body: comment});
    }

    public async postCommentToReviewComment(projectOwner: string, projectName: string, number:number, commentId:number, comment:string) : Promise<void> {
        await this.octoKit.pulls.createReplyForReviewComment({owner: projectOwner, repo:projectName,pull_number:number, comment_id:commentId, body:comment});
    }
}